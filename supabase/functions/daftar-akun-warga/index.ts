// Supabase Edge Function: daftar-akun-warga
// Pendaftaran akun warga (self-service) — login memakai NIK + PIN 6 angka.
//
// Dipanggil dari aplikasi (anon) lewat supabase.functions.invoke('daftar-akun-warga').
// Karena butuh service-role (membuat auth user + menembus RLS), semua logika
// sensitif dijalankan di sisi server ini, TIDAK di klien.
//
// Alur:
//   1. Validasi NIK (16 digit) + PIN (tepat 6 angka, tolak PIN lemah).
//   2. Cek akun warga untuk NIK ini:
//        - AKTIF   -> tolak (suruh login).
//        - PENDING -> tolak (sedang diproses).
//        - NONAKTIF-> tolak (hubungi pengurus).
//        - DITOLAK -> ajukan ulang (pakai kembali auth user, perbarui PIN).
//   3. Cek anti-spam: tolak bila masih ada pengajuan PENDING untuk NIK ini.
//   4. Buat auth user (email sintetis <nik>@warga.rt004.id, password = PIN).
//   5. Insert baris pengajuan (warga_submissions_rt004) + akun (warga_akun, PENDING).
//   6. Bila gagal setelah user dibuat, hapus user agar tidak jadi orphan.
//
// Secret/env yang dipakai (tersedia otomatis di Edge Functions):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

interface DaftarPayload {
  nik?: string;
  pin?: string;
  nomorKK?: string;
  nama?: string;
  jenisKelamin?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  agama?: string;
  pekerjaan?: string;
  statusPerkawinan?: string;
  statusHubunganKK?: string;
  golonganDarah?: string;
  nomorHp?: string;
  statusTinggal?: string;
  isYatim?: boolean;
  isDisabilitas?: boolean;
  statusBansos?: string;
  keteranganBansos?: string;
  catatan?: string;
}

/** PIN lemah: 6 digit identik, berurutan naik/turun, atau pola umum. */
function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true; // 000000, 111111, ...
  if ('0123456789'.includes(pin)) return true; // 012345, 123456, 456789, ...
  if ('9876543210'.includes(pin)) return true; // 987654, 654321, ...
  const common = ['112233', '121212', '123123', '696969', '112211', '102030'];
  return common.includes(pin);
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), { status, headers: jsonHeaders });
}

function clean(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return err('Metode tidak didukung.', 405);

  let body: DaftarPayload;
  try {
    body = await req.json();
  } catch {
    return err('Body permintaan bukan JSON yang valid.');
  }

  const nik = (body.nik ?? '').trim();
  const pin = (body.pin ?? '').trim();
  const nama = (body.nama ?? '').trim();

  // 1. Validasi
  if (!/^[0-9]{16}$/.test(nik)) return err('NIK harus 16 digit angka.');
  if (!/^[0-9]{6}$/.test(pin)) return err('PIN harus tepat 6 angka.');
  if (isWeakPin(pin)) return err('PIN terlalu mudah ditebak. Hindari angka berurutan/berulang seperti 123456 atau 000000.');
  if (nama.length < 2) return err('Nama wajib diisi.');
  if (!body.tanggalLahir) return err('Tanggal lahir wajib diisi.');
  const nomorKK = (body.nomorKK ?? '').trim();
  if (nomorKK !== '' && !/^[0-9]{16}$/.test(nomorKK)) return err('Nomor KK harus 16 digit angka.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return err('Konfigurasi server belum lengkap.', 500);
  const admin = createClient(supabaseUrl, serviceKey);

  const email = `${nik}@warga.rt004.id`;

  try {
    // 2. Cek akun warga untuk NIK ini
    const { data: akunLama, error: akunErr } = await admin
      .from('warga_akun')
      .select('id, status')
      .eq('nik', nik)
      .maybeSingle();
    if (akunErr) throw new Error(`Gagal memeriksa akun: ${akunErr.message}`);

    let reapplyUid: string | null = null;
    if (akunLama) {
      if (akunLama.status === 'AKTIF') return err('NIK ini sudah punya akun aktif. Silakan login memakai PIN Anda.', 409);
      if (akunLama.status === 'PENDING') return err('Pendaftaran untuk NIK ini sedang ditinjau pengurus. Mohon tunggu.', 409);
      if (akunLama.status === 'NONAKTIF') return err('Akun untuk NIK ini dinonaktifkan. Hubungi pengurus RT.', 409);
      // DITOLAK -> boleh ajukan ulang memakai auth user yang sama.
      reapplyUid = akunLama.id as string;
    }

    // 3. Anti-spam pengajuan
    const { data: subPending, error: subErr } = await admin
      .from('warga_submissions_rt004')
      .select('id')
      .eq('nik', nik)
      .eq('status', 'PENDING')
      .maybeSingle();
    if (subErr) throw new Error(`Gagal memeriksa pengajuan: ${subErr.message}`);
    if (subPending) return err('Masih ada pengajuan untuk NIK ini yang sedang diproses. Mohon tunggu.', 409);

    // 4. Deteksi BARU vs PERBARUI
    const { data: wargaCocok } = await admin
      .from('warga_rt004')
      .select('id')
      .eq('nik', nik)
      .maybeSingle();
    const jenisPengajuan = wargaCocok ? 'PERBARUI' : 'BARU';
    const matchedWargaId = wargaCocok?.id ?? null;

    // 5. Buat / perbarui auth user
    let uid: string;
    if (reapplyUid) {
      uid = reapplyUid;
      const { error: updErr } = await admin.auth.admin.updateUserById(uid, { password: pin });
      if (updErr) throw new Error(`Gagal memperbarui PIN: ${updErr.message}`);
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
        user_metadata: { role: 'WARGA', nik, nama },
      });
      if (createErr || !created?.user) {
        const msg = createErr?.message ?? 'Gagal membuat akun.';
        if (/already been registered|already registered|duplicate/i.test(msg)) {
          return err('NIK ini sudah terdaftar. Bila lupa PIN, hubungi pengurus RT untuk reset.', 409);
        }
        throw new Error(msg);
      }
      uid = created.user.id;
    }

    // 6. Insert pengajuan (service-role menembus RLS)
    const submissionRow = {
      nik,
      nomor_kk: nomorKK || null,
      nama,
      jenis_kelamin: clean(body.jenisKelamin)?.toUpperCase() ?? null,
      tempat_lahir: clean(body.tempatLahir),
      tanggal_lahir: body.tanggalLahir,
      agama: clean(body.agama) ?? 'ISLAM',
      pekerjaan: clean(body.pekerjaan),
      status_perkawinan: clean(body.statusPerkawinan),
      status_hubungan_kk: clean(body.statusHubunganKK),
      golongan_darah: clean(body.golonganDarah) ?? '-',
      nomor_hp: clean(body.nomorHp),
      status_tinggal: clean(body.statusTinggal) ?? 'TETAP',
      is_yatim: !!body.isYatim,
      is_disabilitas: !!body.isDisabilitas,
      status_bansos: clean(body.statusBansos) ?? 'TIDAK_ADA',
      keterangan_bansos: clean(body.keteranganBansos),
      catatan: clean(body.catatan),
      jenis_pengajuan: jenisPengajuan,
      matched_warga_id: matchedWargaId,
      status: 'PENDING',
      akun_user_id: uid,
    };

    const { data: sub, error: insSubErr } = await admin
      .from('warga_submissions_rt004')
      .insert(submissionRow)
      .select('id')
      .single();

    if (insSubErr || !sub) {
      if (!reapplyUid) await admin.auth.admin.deleteUser(uid); // hindari orphan
      throw new Error(`Gagal menyimpan pengajuan: ${insSubErr?.message ?? 'tidak diketahui'}`);
    }

    // 7. Insert / perbarui baris akun (PENDING)
    const akunRow = {
      id: uid,
      nik,
      nama,
      nomor_hp: clean(body.nomorHp),
      status: 'PENDING',
      submission_id: sub.id,
      diaktifkan_at: null,
    };
    const { error: upErr } = await admin.from('warga_akun').upsert(akunRow, { onConflict: 'id' });
    if (upErr) {
      if (!reapplyUid) await admin.auth.admin.deleteUser(uid);
      throw new Error(`Gagal menyimpan akun: ${upErr.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pendaftaran terkirim. Akun Anda akan aktif setelah disetujui pengurus RT.',
        referensi: sub.id,
        status: 'PENDING',
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('daftar-akun-warga error:', message);
    return err(message, 500);
  }
});
