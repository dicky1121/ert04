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

Hanya **satu** secret yang wajib:

| Secret Name | Value | Keterangan |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | `{ "type": "service_account", ... }` | Seluruh isi file JSON Service Account dari Firebase Console → Project Settings → Service Accounts → **Generate new private key** |

Opsional:

| Secret Name | Value | Keterangan |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `ert004` | Hanya perlu bila ingin menimpa `project_id` yang sudah ada di dalam JSON service account |

> `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` **tidak perlu** di-set manual — Supabase menyediakannya otomatis.

Cara set via CLI:

```bash
npx supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat ~/Downloads/ert004-firebase-adminsdk.json)"
```

> **Tidak perlu lagi `FIREBASE_ACCESS_TOKEN`.** Function ini menandatangani JWT
> RS256 sendiri memakai Web Crypto API bawaan Deno, lalu menukarnya dengan
> OAuth2 access token dan menyimpannya di cache sampai 5 menit sebelum
> kedaluwarsa. Jadi tidak ada lagi token yang mati setiap 1 jam.

### 3. Pastikan izin notifikasi ada di AndroidManifest.xml

Android 13+ (API 33) menolak notifikasi tanpa izin ini. Karena folder `android/`
tidak ikut di-commit ke git, cek ulang setiap kali project di-clone atau
di-generate ulang dengan `npx cap add android`:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
```


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

### Error: "Secret FIREBASE_SERVICE_ACCOUNT belum di-set"
- Set secret `FIREBASE_SERVICE_ACCOUNT` di Supabase Dashboard → Edge Functions → Secrets
- Isinya harus **seluruh** isi file JSON service account, termasuk tanda `{` dan `}`

### Error: "FIREBASE_SERVICE_ACCOUNT bukan JSON yang valid"
- JSON terpotong saat di-paste. Pastikan tersalin utuh dari awal `{` sampai akhir `}`

### Error: "Gagal menukar JWT dengan access token: 400 invalid_grant"
- Jam server tidak sinkron, atau `private_key` rusak saat di-paste
- Cara paling aman: generate ulang private key baru di Firebase Console

### Error: "FCM error 401 Unauthorized"
- Service account tidak punya peran **Firebase Cloud Messaging API Admin**
- Buka Google Cloud Console → IAM & Admin → tambahkan peran tersebut


### Error: "FCM error 404 Not Found"
- `FIREBASE_PROJECT_ID` salah atau project tidak ada
- Verifikasi Project ID di Firebase Console

### Notifikasi tidak masuk ke device
- **Cek `POST_NOTIFICATIONS` ada di AndroidManifest.xml** (lihat langkah 3) — ini
  penyebab paling sering pada Android 13+
- Pastikan FCM token sudah terdaftar di tabel `ews_fcm_tokens`
- Cek apakah device mengaktifkan notifikasi untuk aplikasi
- Verifikasi `google-services.json` sudah ditambahkan ke folder `android/app/`
- APK harus di-build ulang setelah manifest berubah (`npx cap sync android`)
- Test kirim notifikasi manual via Firebase Console → Cloud Messaging

## Catatan Implementasi

JWT signing sudah **selesai diimplementasikan** di `index.ts`, memakai
`crypto.subtle` bawaan Deno tanpa library eksternal:

1. Susun JWT (header + claim) lalu encode Base64URL
2. Tanda tangani dengan `RSASSA-PKCS1-v1_5` + SHA-256 (setara RS256) memakai
   `private_key` dari service account
3. Tukar JWT dengan OAuth2 token via `https://oauth2.googleapis.com/token`
4. Cache token di memori sampai 5 menit sebelum kedaluwarsa

Function juga otomatis menghapus token yang dijawab `UNREGISTERED`/404 oleh FCM,
sehingga tabel `ews_fcm_tokens` tidak menumpuk token milik aplikasi yang sudah
di-uninstall.


## Reference

- [Firebase Cloud Messaging HTTP v1 API](https://firebase.google.com/docs/cloud-messaging/http-server-ref)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
