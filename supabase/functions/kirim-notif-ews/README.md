# Supabase Edge Function: kirim-notif-ews

Edge Function untuk mengirim push notification FCM (Firebase Cloud Messaging) ke semua device Android yang terdaftar saat ada laporan EWS baru.

## Cara Kerja

```
INSERT ke ews_laporan_rt004
  ↓
Database Webhook trigger Edge Function
  ↓
Edge Function ambil semua FCM tokens dari ews_fcm_tokens
  ↓
Kirim multicast notification via FCM HTTP v1 API
  ↓
Notifikasi masuk ke device Android (bahkan saat app tertutup)
```

## Setup

### 1. Deploy Edge Function

```bash
# Di root project
npx supabase functions deploy kirim-notif-ews
```

### 2. Set Environment Secrets di Supabase Dashboard

Buka **Supabase Dashboard** → **Edge Functions** → **kirim-notif-ews** → **Settings** → **Secrets**, lalu tambahkan:

| Secret Name | Value | Keterangan |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `your-project-id` | Project ID Firebase (dari Firebase Console) |
| `FIREBASE_ACCESS_TOKEN` | `ya29.a0...` | OAuth2 access token Firebase (lihat cara generate di bawah) |

**ATAU** untuk production yang lebih aman:

| Secret Name | Value | Keterangan |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | `{ "type": "service_account", ... }` | JSON Service Account dari Firebase Console → Project Settings → Service Accounts → Generate new private key |

> **Catatan:** Implementasi JWT signing untuk Service Account memerlukan library crypto tambahan di Deno. Untuk development, pakai `FIREBASE_ACCESS_TOKEN` manual yang valid ~1 jam.

### 3. Generate Firebase Access Token (Development)

Cara cepat untuk development/testing:

```bash
# Install Firebase CLI jika belum
npm install -g firebase-tools

# Login
firebase login

# Dapatkan access token
firebase login:ci
# Output: 1//0g... (copy token ini)
```

Atau gunakan Google Cloud Console:
1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Pilih project Firebase
3. IAM & Admin → Service Accounts
4. Create Key (JSON) untuk service account
5. Gunakan JSON tersebut untuk generate OAuth2 token via `gcloud auth application-default print-access-token`

### 4. Setup Database Webhook di Supabase Dashboard

1. Buka **Supabase Dashboard** → **Database** → **Webhooks**
2. Klik **Create a new hook**
3. Isi form:
   - **Name:** `ews-notif-trigger`
   - **Table:** `ews_laporan_rt004`
   - **Events:** `Insert` (centang)
   - **Type:** `HTTP Request`
   - **Method:** `POST`
   - **URL:** `https://<project-ref>.supabase.co/functions/v1/kirim-notif-ews`
   - **HTTP Headers:**
     - Key: `Authorization`
     - Value: `Bearer <SUPABASE_ANON_KEY>` (ambil dari Project Settings → API)
4. Klik **Create webhook**

### 5. Test

Kirim laporan EWS test dari form di aplikasi Android, lalu cek:

1. **Supabase Dashboard** → **Edge Functions** → **kirim-notif-ews** → **Logs**
2. Verifikasi log menunjukkan:
   ```
   📢 Laporan EWS baru: EWS-20260817-ABC123 — KEBAKARAN
   📱 Mengirim notifikasi ke 5 device...
   ✅ Notifikasi terkirim ke 5/5 device.
   ```

## Troubleshooting

### Error: "FIREBASE_ACCESS_TOKEN tidak ditemukan"
- Set secret `FIREBASE_ACCESS_TOKEN` di Supabase Dashboard Edge Functions settings
- Token valid ~1 jam, perlu di-regenerate untuk production

### Error: "FCM error 401 Unauthorized"
- Access token expired atau tidak valid
- Regenerate token atau implementasi Service Account JWT signing

### Error: "FCM error 404 Not Found"
- `FIREBASE_PROJECT_ID` salah atau project tidak ada
- Verifikasi Project ID di Firebase Console

### Notifikasi tidak masuk ke device
- Pastikan FCM token sudah terdaftar di tabel `ews_fcm_tokens`
- Cek apakah device mengaktifkan notifikasi untuk aplikasi
- Verifikasi `google-services.json` sudah ditambahkan ke folder `android/app/`
- Test kirim notifikasi manual via Firebase Console → Cloud Messaging

## Production Notes

Untuk production, implementasikan JWT signing otomatis menggunakan Service Account:

1. Install Deno JWT library:
   ```typescript
   import { create } from "https://deno.land/x/djwt@v2.8/mod.ts";
   ```

2. Sign JWT dengan RS256 algorithm menggunakan private key dari Service Account

3. Exchange JWT dengan OAuth2 token via `https://oauth2.googleapis.com/token`

4. Cache token selama ~50 menit (expires 1 jam)

Alternatif: gunakan Firebase Admin SDK untuk Deno jika tersedia.

## Reference

- [Firebase Cloud Messaging HTTP v1 API](https://firebase.google.com/docs/cloud-messaging/http-server-ref)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
