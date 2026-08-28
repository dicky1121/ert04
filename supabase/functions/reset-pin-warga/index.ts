// Supabase Edge Function: reset-pin-warga
// Reset PIN warga oleh PENGURUS (mis. warga lupa PIN).
//
// Karena login warga memakai email sintetis <nik>@warga.rt004.id yang tidak
// bisa menerima surel, reset tidak bisa lewat email biasa. Fungsi ini memakai
// service-role untuk menyetel PIN baru, TAPI hanya boleh dieksekusi pengurus
// aktif — diverifikasi lewat JWT pemanggil + RPC is_pengurus_aktif().
//
// Dipanggil dari dashboard admin lewat supabase.functions.invoke('reset-pin-warga',
// { body: { nik, newPin } }) — supabase-js otomatis menyertakan JWT pengurus.
//
// Env (tersedia otomatis): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true;
  if ('0123456789'.includes(pin)) return true;
  if ('9876543210'.includes(pin)) return true;
  const common = ['112233', '121212', '123123', '696969', '112211', '102030'];
  return common.includes(pin);
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), { status, headers: jsonHeaders });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return err('Metode tidak didukung.', 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return err('Tidak ada sesi. Harap login sebagai pengurus.', 401);

  let body: { nik?: string; newPin?: string };
  try {
    body = await req.json();
  } catch {
    return err('Body permintaan bukan JSON yang valid.');
  }

  const nik = (body.nik ?? '').trim();
  const newPin = (body.newPin ?? '').trim();
  if (!/^[0-9]{16}$/.test(nik)) return err('NIK harus 16 digit angka.');
  if (!/^[0-9]{6}$/.test(newPin)) return err('PIN baru harus tepat 6 angka.');
  if (isWeakPin(newPin)) return err('PIN terlalu mudah ditebak.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return err('Konfigurasi server belum lengkap.', 500);

  try {
    // 1. Verifikasi pemanggil = pengurus aktif (jalankan is_pengurus_aktif sebagai user itu).
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isPengurus, error: cekErr } = await caller.rpc('is_pengurus_aktif');
    if (cekErr) throw new Error(`Gagal memverifikasi peran: ${cekErr.message}`);
    if (isPengurus !== true) return err('Akses ditolak. Hanya pengurus aktif yang boleh mereset PIN.', 403);

    // 2. Cari auth user warga berdasarkan NIK.
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: akun, error: akunErr } = await admin
      .from('warga_akun')
      .select('id, status')
      .eq('nik', nik)
      .maybeSingle();
    if (akunErr) throw new Error(`Gagal mencari akun: ${akunErr.message}`);
    if (!akun) return err('Akun warga dengan NIK ini tidak ditemukan.', 404);

    // 3. Setel PIN baru.
    const { error: updErr } = await admin.auth.admin.updateUserById(akun.id as string, { password: newPin });
    if (updErr) throw new Error(`Gagal menyetel PIN baru: ${updErr.message}`);

    return new Response(
      JSON.stringify({ success: true, message: 'PIN warga berhasil direset. Sampaikan PIN baru ke warga secara pribadi.' }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (e) {
    const jejak = crypto.randomUUID().slice(0, 8);
    const detail = e instanceof Error ? (e.stack ?? e.message) : String(e);
    console.error(`reset-pin-warga error [${jejak}]:`, detail);
    return err(
      `Terjadi kesalahan di server (kode ${jejak}). Hubungi admin sistem dan sebutkan kode ini.`,
      500
    );
  }
});
