// Supabase Edge Function: kirim-notif-ews
// Dipanggil via Database Webhook saat INSERT ke tabel ews_laporan_rt004
// Mengirim push notification FCM ke semua device Android yang terdaftar

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Firebase Cloud Messaging HTTP v1 API endpoint
const FCM_ENDPOINT = 'https://fcm.googleapis.com/v1/projects/PROJECT_ID/messages:send';

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

// Helper: dapatkan OAuth2 access token dari Service Account
async function getAccessToken(): Promise<string> {
  const serviceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT secret tidak ditemukan. Set via Supabase Dashboard.');
  }

  const sa = JSON.parse(serviceAccount);
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const header = { alg: 'RS256', typ: 'JWT' };
  const encoder = new TextEncoder();
  
  // Sign JWT dengan private key (simplified — production harus pakai crypto library)
  // Untuk demo, gunakan access token yang sudah di-generate manual atau gunakan library
  // Alternatif: gunakan Firebase Admin SDK di Deno
  
  // CATATAN: Implementasi JWT signing di Deno memerlukan library tambahan.
  // Untuk simplicity, dokumentasi ini menyarankan menggunakan Firebase Admin SDK
  // atau pre-generated long-lived token untuk development.
  
  throw new Error('JWT signing belum diimplementasikan. Gunakan Firebase Admin SDK atau token manual.');
}

// Helper: kirim notifikasi ke satu token FCM
async function sendToToken(token: string, laporan: LaporanEWS, accessToken: string): Promise<boolean> {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || 'PROJECT_ID';
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    message: {
      token,
      notification: {
        title: '🚨 Darurat RT 004!',
        body: `${laporan.jenis_kejadian}: ${laporan.deskripsi.slice(0, 80)}${laporan.deskripsi.length > 80 ? '...' : ''} — dilaporkan oleh ${laporan.nama_pelapor}`,
      },
      android: {
        notification: {
          channel_id: 'ews_darurat',
          priority: 'high',
          sound: 'default',
          color: '#DC2626', // rose-600
        },
        priority: 'high',
      },
      data: {
        type: 'EWS',
        laporan_id: laporan.id,
        jenis_kejadian: laporan.jenis_kejadian,
        nama_pelapor: laporan.nama_pelapor,
        alamat: laporan.alamat,
        created_at: laporan.created_at,
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
      console.error(`FCM error for token ${token.slice(0, 10)}...: ${response.status} ${errorText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`Network error sending to token ${token.slice(0, 10)}...:`, err);
    return false;
  }
}

// Main handler
Deno.serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Parse webhook payload dari Supabase Database Webhook
    const payload = await req.json();
    const laporan: LaporanEWS | null = payload.record || payload.new || null;

    if (!laporan || !laporan.id) {
      console.error('Payload tidak valid:', payload);
      return new Response(
        JSON.stringify({ error: 'Invalid payload. Expected record or new field with laporan data.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📢 Laporan EWS baru: ${laporan.id} — ${laporan.jenis_kejadian}`);

    // Inisialisasi Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di environment.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Ambil semua FCM tokens dari database
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
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📱 Mengirim notifikasi ke ${tokens.length} device...`);

    // Dapatkan Firebase access token
    // CATATAN: Implementasi getAccessToken() di atas perlu JWT signing library.
    // Alternatif sederhana untuk development: set FIREBASE_ACCESS_TOKEN manual.
    const accessToken = Deno.env.get('FIREBASE_ACCESS_TOKEN');
    if (!accessToken) {
      console.error('FIREBASE_ACCESS_TOKEN tidak ditemukan. Set secret di Supabase Dashboard atau implementasikan JWT signing.');
      return new Response(
        JSON.stringify({
          error: 'Firebase access token not configured. Set FIREBASE_ACCESS_TOKEN secret or implement JWT signing.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Kirim notifikasi ke semua tokens secara parallel
    const results = await Promise.allSettled(
      tokens.map((t: FCMToken) => sendToToken(t.token, laporan, accessToken))
    );

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value === true
    ).length;

    console.log(`✅ Notifikasi terkirim ke ${successCount}/${tokens.length} device.`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: tokens.length,
        laporan_id: laporan.id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('❌ Error di Edge Function:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
