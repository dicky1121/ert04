// Supabase Edge Function: kirim-notif-pengumuman
//
// Menyiarkan satu pengumuman RT sebagai push notification FCM ke semua HP
// yang terdaftar di `ews_fcm_tokens`.
//
// Berbeda dengan `kirim-notif-ews` yang dipicu Database Webhook secara
// otomatis, fungsi ini dipanggil MANUAL oleh pengurus dari dashboard —
// menerbitkan pengumuman dan menyiarkannya adalah dua keputusan berbeda,
// dan tidak setiap koreksi ketik pantas membangunkan seluruh warga.
//
// Karena dipicu klien, ada dua penjagaan yang tidak dibutuhkan versi EWS:
//   1. Pemanggil WAJIB pengurus aktif — diverifikasi lewat JWT-nya sendiri
//      dengan RPC is_pengurus_aktif() (pola sama seperti reset-pin-warga).
//   2. Klien hanya mengirim `pengumuman_id`. Judul & isi dibaca ULANG di sini
//      memakai service role, jadi teks notifikasi tidak bisa disuntik dari
//      luar dan pengumuman yang masih draf ditolak.
//
// Secret yang harus di-set di Supabase Dashboard (Edge Functions > Secrets):
//   FIREBASE_SERVICE_ACCOUNT = isi lengkap file JSON service account Firebase
// SUPABASE_URL, SUPABASE_ANON_KEY & SUPABASE_SERVICE_ROLE_KEY otomatis ada.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Pengumuman {
  id: string;
  judul: string;
  isi: string;
  kategori: string;
  dipublikasikan: boolean;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
}

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

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), { status, headers: jsonHeaders });
}

// ── util encoding ────────────────────────────────────────────────────────────

/** Base64URL encode (tanpa padding) — format wajib untuk JWT. */
function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Ubah private key PEM (PKCS#8) dari service account menjadi CryptoKey RS256. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Service account JSON menyimpan newline sebagai "\n" literal bila secret
  // di-paste sebagai satu baris — normalkan dulu agar PEM valid.
  const normalized = pem.replace(/\\n/g, '\n');
  const base64 = normalized
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

  return await crypto.subtle.importKey(
    'pkcs8',
    bytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// ── OAuth2: tukar JWT service account dengan access token ────────────────────

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Access token OAuth2 untuk FCM HTTP v1, di-cache sampai 5 menit sebelum kedaluwarsa. */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && cachedToken.expiresAt - 300 > now) {
    return cachedToken.value;
  }

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
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
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

  if (!response.ok) {
    throw new Error(`Gagal menukar JWT dengan access token: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  if (!result.access_token) {
    throw new Error('Respons OAuth2 tidak memuat access_token.');
  }

  cachedToken = {
    value: result.access_token,
    expiresAt: now + (result.expires_in ?? 3600),
  };
  return cachedToken.value;
}

// ── pengiriman notifikasi ────────────────────────────────────────────────────

/** Ringkas isi pengumuman jadi satu baris body notifikasi. */
function ringkas(isi: string, maks = 140): string {
  const satuBaris = (isi ?? '').replace(/\s+/g, ' ').trim();
  return satuBaris.length > maks ? `${satuBaris.slice(0, maks)}…` : satuBaris;
}

/**
 * Kirim notifikasi pengumuman ke satu token FCM.
 * Mengembalikan status agar token yang sudah mati bisa dibersihkan.
 */
async function sendToToken(
  token: string,
  p: Pengumuman,
  accessToken: string,
  projectId: string
): Promise<{ ok: boolean; invalid: boolean }> {
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    message: {
      token,
      notification: {
        title: `📢 ${p.judul}`.slice(0, 120),
        body: ringkas(p.isi),
      },
      android: {
        // Channel terpisah dari EWS: warga boleh mematikan pengumuman rutin
        // tanpa ikut membisukan notifikasi darurat.
        notification: {
          channel_id: 'pengumuman_rt',
          sound: 'default',
          color: '#059669', // emerald-600
        },
        priority: 'normal',
      },
      data: {
        type: 'PENGUMUMAN',
        pengumuman_id: String(p.id),
        judul: String(p.judul ?? ''),
        kategori: String(p.kategori ?? 'UMUM'),
      },
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`FCM error token ${token.slice(0, 10)}...: ${response.status} ${errorText}`);
      // 404 UNREGISTERED / 400 INVALID_ARGUMENT = token sudah tidak berlaku
      const invalid =
        response.status === 404 ||
        errorText.includes('UNREGISTERED') ||
        errorText.includes('INVALID_ARGUMENT');
      return { ok: false, invalid };
    }

    return { ok: true, invalid: false };
  } catch (e) {
    console.error(`Network error token ${token.slice(0, 10)}...:`, e);
    return { ok: false, invalid: false };
  }
}

// ── handler utama ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return err('Metode tidak didukung.', 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return err('Tidak ada sesi. Harap login sebagai pengurus.', 401);

  let body: { pengumuman_id?: string };
  try {
    body = await req.json();
  } catch {
    return err('Body permintaan bukan JSON yang valid.');
  }

  const pengumumanId = (body.pengumuman_id ?? '').trim();
  if (!pengumumanId) return err('pengumuman_id wajib diisi.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return err('Konfigurasi server belum lengkap.', 500);

  try {
    // 1. Verifikasi pemanggil = pengurus aktif (jalankan RPC sebagai user itu).
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isPengurus, error: cekErr } = await caller.rpc('is_pengurus_aktif');
    if (cekErr) throw new Error(`Gagal memverifikasi peran: ${cekErr.message}`);
    if (isPengurus !== true) {
      return err('Akses ditolak. Hanya pengurus aktif yang boleh menyiarkan pengumuman.', 403);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 2. Baca ulang pengumuman dari server — teks notifikasi TIDAK boleh
    //    berasal dari klien.
    const { data: pengumuman, error: bacaErr } = await admin
      .from('pengumuman_rt004')
      .select('id, judul, isi, kategori, dipublikasikan, tanggal_mulai, tanggal_selesai')
      .eq('id', pengumumanId)
      .maybeSingle();
    if (bacaErr) throw new Error(`Gagal membaca pengumuman: ${bacaErr.message}`);
    if (!pengumuman) return err('Pengumuman tidak ditemukan.', 404);

    const p = pengumuman as Pengumuman;
    if (!p.dipublikasikan) {
      return err('Pengumuman masih berstatus draf. Terbitkan dulu sebelum menyiarkannya.');
    }

    // 3. Service account Firebase.
    const rawServiceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!rawServiceAccount) {
      throw new Error(
        'Secret FIREBASE_SERVICE_ACCOUNT belum di-set. Buka Supabase Dashboard > Edge Functions > Secrets, ' +
          'lalu tempel seluruh isi file JSON service account Firebase.'
      );
    }

    let sa: ServiceAccount;
    try {
      sa = JSON.parse(rawServiceAccount);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT bukan JSON yang valid. Tempel seluruh isi file JSON-nya.');
    }
    if (!sa.client_email || !sa.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT tidak memuat client_email / private_key.');
    }

    const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || sa.project_id;
    if (!projectId) {
      throw new Error('project_id Firebase tidak diketahui. Set secret FIREBASE_PROJECT_ID.');
    }

    // 4. Ambil daftar token tujuan.
    const { data: tokens, error: tokenError } = await admin.from('ews_fcm_tokens').select('token');
    if (tokenError) throw new Error(`Gagal mengambil FCM tokens: ${tokenError.message}`);

    if (!tokens || tokens.length === 0) {
      console.log('⚠️  Tidak ada FCM token terdaftar. Notifikasi tidak dikirim.');
      return new Response(
        JSON.stringify({ success: true, sent: 0, total: 0, message: 'Belum ada HP terdaftar.' }),
        { status: 200, headers: jsonHeaders }
      );
    }

    console.log(`📢 Menyiarkan pengumuman ${p.id} ke ${tokens.length} device...`);

    const accessToken = await getAccessToken(sa);
    const daftarToken = (tokens as { token: string }[]).map((t) => t.token);
    const results = await Promise.all(
      daftarToken.map((token) => sendToToken(token, p, accessToken, projectId))
    );

    const successCount = results.filter((r) => r.ok).length;

    // 5. Bersihkan token yang sudah tidak berlaku (app di-uninstall / data direset).
    const tokenMati = daftarToken.filter((_, i) => results[i].invalid);
    if (tokenMati.length > 0) {
      const { error: hapusError } = await admin.from('ews_fcm_tokens').delete().in('token', tokenMati);
      if (hapusError) {
        console.error('Gagal membersihkan token mati:', hapusError.message);
      } else {
        console.log(`🧹 ${tokenMati.length} token tidak berlaku dihapus.`);
      }
    }

    console.log(`✅ Pengumuman terkirim ke ${successCount}/${daftarToken.length} device.`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: daftarToken.length,
        dibersihkan: tokenMati.length,
        pengumuman_id: p.id,
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('❌ kirim-notif-pengumuman error:', message);
    return err(message, 500);
  }
});
