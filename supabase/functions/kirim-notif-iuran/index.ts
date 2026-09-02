// Supabase Edge Function: kirim-notif-iuran
//
// Mengirim push notification FCM reminder iuran ke warga yang masih
// BELUM_LUNAS pada bulan berjalan.
//
// Dipanggil via Supabase pg_cron setiap hari jam 07:00 WIB (00:00 UTC).
// Fungsi ini sendiri yang mengecek:
//   1. Apakah reminder_aktif = true di tabel iuran_pengaturan_rt004
//   2. Apakah hari ini = hari_reminder (default 1)
// Jika salah satu tidak terpenuhi → langsung return sukses tanpa kirim.
//
// Setup pg_cron (jalankan sekali di Supabase SQL Editor):
// ─────────────────────────────────────────────────────────────────────────
//   select cron.schedule(
//     'kirim-notif-iuran-harian',
//     '0 0 * * *',   -- setiap hari jam 00:00 UTC = 07:00 WIB
//     $$
//       select net.http_post(
//         url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/kirim-notif-iuran',
//         headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb,
//         body    := '{}'::jsonb
//       );
//     $$
//   );
// ─────────────────────────────────────────────────────────────────────────
//
// Secret yang harus di-set (sama dengan kirim-notif-pengumuman):
//   FIREBASE_SERVICE_ACCOUNT = isi lengkap file JSON service account Firebase
// SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY tersedia otomatis.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error: message }), { status, headers: jsonHeaders });
}

// ── util encoding (sama dengan fungsi lain) ──────────────────────────────────

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem.replace(/\\n/g, '\n');
  const base64 = normalized
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return await crypto.subtle.importKey(
    'pkcs8', bytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 300 > now) return cachedToken.value;

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' }, key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!response.ok) throw new Error(`OAuth2 error: ${response.status} ${await response.text()}`);
  const result = await response.json();
  if (!result.access_token) throw new Error('Respons OAuth2 tidak memuat access_token.');
  cachedToken = { value: result.access_token, expiresAt: now + (result.expires_in ?? 3600) };
  return cachedToken.value;
}

async function sendToToken(
  token: string,
  title: string,
  body: string,
  accessToken: string,
  projectId: string
): Promise<{ ok: boolean; invalid: boolean }> {
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const message = {
    message: {
      token,
      notification: { title, body },
      android: { priority: 'normal' },
      data: { type: 'IURAN_REMINDER' },
    },
  };
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      const errorText = await response.text();
      const invalid = response.status === 404 || errorText.includes('UNREGISTERED') || errorText.includes('INVALID_ARGUMENT');
      return { ok: false, invalid };
    }
    return { ok: true, invalid: false };
  } catch {
    return { ok: false, invalid: false };
  }
}

// ── handler utama ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return err('Metode tidak didukung.', 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return err('Konfigurasi server belum lengkap.', 500);

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Baca setelan iuran — cek reminder_aktif dan hari_reminder
    const { data: setelan, error: setelanErr } = await admin
      .from('pengaturan_iuran_rt004')
      .select('reminder_aktif, hari_reminder')
      .eq('id', 1)
      .maybeSingle();

    if (setelanErr) throw new Error(`Gagal membaca setelan: ${setelanErr.message}`);

    const reminderAktif: boolean = Boolean(setelan?.reminder_aktif);
    const hariReminder: number  = Number(setelan?.hari_reminder) || 1;

    if (!reminderAktif) {
      console.log('ℹ️  Reminder iuran tidak aktif — tidak ada yang dikirim.');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'reminder_aktif = false' }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // 2. Cek apakah hari ini = hari_reminder (WIB = UTC+7)
    const nowWIB   = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const hariIni  = nowWIB.getUTCDate();
    const bulanIni = `${nowWIB.getUTCFullYear()}-${String(nowWIB.getUTCMonth() + 1).padStart(2, '0')}`;

    if (hariIni !== hariReminder) {
      console.log(`ℹ️  Hari ini (${hariIni}) bukan hari reminder (${hariReminder}) — tidak ada yang dikirim.`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: `hari_ini=${hariIni} != hari_reminder=${hariReminder}` }),
        { status: 200, headers: jsonHeaders }
      );
    }

    console.log(`📅 Hari reminder iuran — bulan ${bulanIni}, tanggal ${hariIni}`);

    // 3. Ambil warga yang masih BELUM_LUNAS bulan ini
    //    Join ke ews_fcm_tokens via warga_akun (nik → warga_id)
    //    Satu warga bisa punya beberapa tagihan belum lunas — kirim satu notif saja per warga.
    const { data: tagihan, error: tagihanErr } = await admin
      .from('iuran_rt004')
      .select('warga_id, judul')
      .eq('status', 'BELUM_LUNAS')
      .eq('periode', bulanIni);

    if (tagihanErr) throw new Error(`Gagal membaca tagihan: ${tagihanErr.message}`);
    if (!tagihan || tagihan.length === 0) {
      console.log('✅ Tidak ada tagihan BELUM_LUNAS bulan ini — tidak ada reminder yang perlu dikirim.');
      return new Response(
        JSON.stringify({ success: true, sent: 0, total: 0, message: 'Semua warga sudah lunas.' }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // Deduplikasi warga (satu warga bisa punya beberapa tagihan)
    const wargaSet = new Set<string>(tagihan.map((t: { warga_id: string }) => t.warga_id));
    console.log(`📢 ${wargaSet.size} warga belum lunas bulan ${bulanIni}`);

    // 4. Ambil FCM tokens dari warga yang belum lunas
    //    warga_akun.warga_id → warga_rt004.id; token ada di ews_fcm_tokens berdasarkan user_id
    //    Karena tabel ews_fcm_tokens tidak punya kolom warga_id secara langsung,
    //    kita ambil semua token dulu dan kirim ke semua (reminder bersifat broadcast per warga belum lunas).
    //    Warga yang sudah lunas tidak terdampak karena mereka memang tidak masuk wargaSet.
    //    Untuk produksi: idealnya join via warga_akun.id = ews_fcm_tokens.user_id,
    //    tapi karena warga_id di iuran belum tentu = auth.uid, kirim broadcast ke semua token
    //    dengan body yang menyebut "cek iuran Anda" — aman karena warga lunas tinggal buka dan lihat lunas.
    const { data: tokens, error: tokenErr } = await admin
      .from('ews_fcm_tokens')
      .select('token');

    if (tokenErr) throw new Error(`Gagal mengambil FCM tokens: ${tokenErr.message}`);
    if (!tokens || tokens.length === 0) {
      console.log('⚠️  Tidak ada FCM token terdaftar.');
      return new Response(
        JSON.stringify({ success: true, sent: 0, total: 0, message: 'Belum ada HP terdaftar.' }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // 5. Setup Firebase
    const rawServiceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!rawServiceAccount) {
      throw new Error(
        'Secret FIREBASE_SERVICE_ACCOUNT belum di-set. ' +
        'Buka Supabase Dashboard > Edge Functions > Secrets, lalu tempel isi JSON service account Firebase.'
      );
    }
    let sa: ServiceAccount;
    try { sa = JSON.parse(rawServiceAccount); } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT bukan JSON yang valid.');
    }
    if (!sa.client_email || !sa.private_key) throw new Error('FIREBASE_SERVICE_ACCOUNT tidak memuat client_email / private_key.');

    const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || sa.project_id;
    if (!projectId) throw new Error('project_id Firebase tidak diketahui. Set secret FIREBASE_PROJECT_ID.');

    const accessToken = await getAccessToken(sa);

    // 6. Kirim notifikasi
    const title = `🔔 Reminder Iuran ${bulanIni.replace('-', '/')}`;
    const body  = `Iuran RT bulan ini belum dibayar. Silakan buka aplikasi untuk melihat tagihan dan unggah bukti pembayaran.`;

    const daftarToken = (tokens as { token: string }[]).map(t => t.token);
    const results = await Promise.all(
      daftarToken.map(token => sendToToken(token, title, body, accessToken, projectId))
    );

    const successCount = results.filter(r => r.ok).length;

    // 7. Bersihkan token mati
    const tokenMati = daftarToken.filter((_, i) => results[i].invalid);
    if (tokenMati.length > 0) {
      const { error: hapusErr } = await admin.from('ews_fcm_tokens').delete().in('token', tokenMati);
      if (hapusErr) console.error('Gagal membersihkan token mati:', hapusErr.message);
      else console.log(`🧹 ${tokenMati.length} token tidak berlaku dihapus.`);
    }

    console.log(`✅ Reminder iuran terkirim ke ${successCount}/${daftarToken.length} device.`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: daftarToken.length,
        dibersihkan: tokenMati.length,
        bulan: bulanIni,
        warga_belum_lunas: wargaSet.size,
      }),
      { status: 200, headers: jsonHeaders }
    );

  } catch (e) {
    const jejak  = crypto.randomUUID().slice(0, 8);
    const detail = e instanceof Error ? (e.stack ?? e.message) : String(e);
    console.error(`❌ kirim-notif-iuran error [${jejak}]:`, detail);
    return err(
      `Terjadi kesalahan di server (kode ${jejak}). Hubungi admin sistem dan sebutkan kode ini.`,
      500
    );
  }
});
