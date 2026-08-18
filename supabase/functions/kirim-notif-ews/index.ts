// Supabase Edge Function: kirim-notif-ews
// Dipanggil via Database Webhook saat INSERT ke tabel ews_laporan_rt004
// Mengirim push notification FCM ke semua device Android yang terdaftar
//
// Autentikasi ke FCM HTTP v1 memakai OAuth2 Service Account: JWT RS256
// ditandatangani langsung dengan Web Crypto API bawaan Deno, jadi TIDAK perlu
// library eksternal maupun token manual yang kedaluwarsa setiap 1 jam.
//
// Secret yang harus di-set di Supabase Dashboard (Edge Functions > Secrets):
//   FIREBASE_SERVICE_ACCOUNT = isi lengkap file JSON service account Firebase
// SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY sudah tersedia otomatis.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface LaporanEWS {
  id: string;
  jenis_kejadian: string;
  deskripsi: string;
  nama_pelapor: string;
  alamat: string;
  created_at: string;
}

interface FCMToken {
  token: string;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
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

/**
 * Menghasilkan OAuth2 access token untuk FCM HTTP v1.
 * Token di-cache di memori sampai 5 menit sebelum kedaluwarsa agar satu
 * instance function tidak berulang kali memanggil endpoint token Google.
 */
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

/**
 * Kirim notifikasi ke satu token FCM.
 * Mengembalikan status agar token yang sudah mati bisa dibersihkan.
 */
async function sendToToken(
  token: string,
  laporan: LaporanEWS,
  accessToken: string,
  projectId: string
): Promise<{ ok: boolean; invalid: boolean }> {
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const deskripsi = laporan.deskripsi ?? '';

  const message = {
    message: {
      token,
      notification: {
        title: '🚨 Darurat RT 004!',
        body: `${laporan.jenis_kejadian}: ${deskripsi.slice(0, 80)}${deskripsi.length > 80 ? '...' : ''} — dilaporkan oleh ${laporan.nama_pelapor}`,
      },
      android: {
        notification: {
          channel_id: 'ews_darurat',
          sound: 'default',
          color: '#DC2626', // rose-600
        },
        priority: 'high',
      },
      data: {
        type: 'EWS',
        laporan_id: String(laporan.id),
        jenis_kejadian: String(laporan.jenis_kejadian),
        nama_pelapor: String(laporan.nama_pelapor),
        alamat: String(laporan.alamat ?? ''),
        created_at: String(laporan.created_at ?? ''),
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
  } catch (err) {
    console.error(`Network error token ${token.slice(0, 10)}...:`, err);
    return { ok: false, invalid: false };
  }
}

// ── handler utama ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const payload = await req.json();
    const laporan: LaporanEWS | null = payload.record || payload.new || null;

    if (!laporan || !laporan.id) {
      console.error('Payload tidak valid:', payload);
      return new Response(
        JSON.stringify({ error: 'Invalid payload. Expected record or new field with laporan data.' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    console.log(`📢 Laporan EWS baru: ${laporan.id} — ${laporan.jenis_kejadian}`);

    // Service account Firebase
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

    // Supabase client (service role — perlu untuk baca & bersihkan token)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di environment.');
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tokens, error: tokenError } = await supabase
      .from('ews_fcm_tokens')
      .select('token');

    if (tokenError) {
      throw new Error(`Gagal mengambil FCM tokens: ${tokenError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️  Tidak ada FCM token terdaftar. Notifikasi tidak dikirim.');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No FCM tokens registered.' }),
        { status: 200, headers: jsonHeaders }
      );
    }

    console.log(`📱 Mengirim notifikasi ke ${tokens.length} device...`);

    const accessToken = await getAccessToken(sa);

    const daftarToken = (tokens as FCMToken[]).map((t) => t.token);
    const results = await Promise.all(
      daftarToken.map((token) => sendToToken(token, laporan, accessToken, projectId))
    );

    const successCount = results.filter((r) => r.ok).length;

    // Bersihkan token yang sudah tidak berlaku (app di-uninstall / data direset)
    const tokenMati = daftarToken.filter((_, i) => results[i].invalid);
    if (tokenMati.length > 0) {
      const { error: hapusError } = await supabase
        .from('ews_fcm_tokens')
        .delete()
        .in('token', tokenMati);
      if (hapusError) {
        console.error('Gagal membersihkan token mati:', hapusError.message);
      } else {
        console.log(`🧹 ${tokenMati.length} token tidak berlaku dihapus.`);
      }
    }

    console.log(`✅ Notifikasi terkirim ke ${successCount}/${daftarToken.length} device.`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: daftarToken.length,
        dibersihkan: tokenMati.length,
        laporan_id: laporan.id,
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Error di Edge Function:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
