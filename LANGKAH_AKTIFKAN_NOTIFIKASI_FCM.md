# Langkah Mengaktifkan Notifikasi FCM (EWS Darurat)

Panduan ini memakai nilai **asli** proyek Anda, jadi bisa langsung diikuti tanpa diubah.

| Keterangan | Nilai |
|---|---|
| Project Firebase | `ert004` |
| Package aplikasi Android | `id.go.bekasi.jatimulya.rt004` |
| Project ref Supabase | `nginmiqjfzycvbbufbev` |
| URL Edge Function | `https://nginmiqjfzycvbbufbev.supabase.co/functions/v1/kirim-notif-ews` |

## Status Terkini (18 Agustus 2026)

| Langkah | Status |
|---|---|
| 1. Service Account key | ✅ selesai |
| 2. Cloud Messaging API | ✅ aktif (sudah diuji) |
| 3. Secret `FIREBASE_SERVICE_ACCOUNT` | ✅ sudah di-set |
| 4. Deploy Edge Function | ✅ berhasil |
| **Uji kirim notifikasi** | ✅ **notifikasi tampil di HP** |
| 5. Database Webhook | ⚠️ perlu dipastikan (lihat Langkah 5) |
| 6. Build APK baru | ⚠️ perlu untuk HP lain / distribusi |

Hasil uji Edge Function:
`{"success":true,"sent":1,"total":1,"dibersihkan":0}`

Artinya rantai JWT → OAuth2 → FCM → HP sudah terbukti bekerja.
Sisanya hanya memastikan pengiriman berjalan **otomatis** (Langkah 5) dan
membuat APK baru agar HP lain juga bisa menerima (Langkah 6).


---

## Langkah 1 — Ambil kunci Service Account dari Firebase

1. Buka https://console.firebase.google.com/ lalu pilih project **ert004**
2. Klik ikon gerigi ⚙️ (kiri atas) → **Project settings**
3. Pindah ke tab **Service accounts**
4. Klik tombol **Generate new private key** → **Generate key**
5. Sebuah file JSON akan terunduh, contoh namanya:
   `ert004-firebase-adminsdk-xxxxx.json`

> ⚠️ File ini setara kunci induk. Jangan pernah dimasukkan ke git, jangan
> dikirim lewat WhatsApp/grup. Simpan di folder pribadi Anda saja.

---

## Langkah 2 — Aktifkan Cloud Messaging API

1. Buka https://console.cloud.google.com/apis/library/fcm.googleapis.com
2. Pastikan project yang terpilih di bagian atas adalah **ert004**
3. Bila tombolnya masih **Enable**, klik. Bila sudah tertulis **Manage** /
   **API enabled**, artinya sudah aktif — lanjut.

---

## Langkah 3 — Simpan Service Account sebagai Secret di Supabase

1. Buka https://supabase.com/dashboard/project/nginmiqjfzycvbbufbev/settings/functions
   (menu: **Project Settings** → **Edge Functions** → bagian **Secrets**)
2. Klik **Add new secret**
3. Isi:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** buka file JSON dari Langkah 1 dengan Notepad, tekan
     `Ctrl+A` lalu `Ctrl+C`, dan tempel **seluruhnya** di sini
     (harus ikut tanda `{` di awal dan `}` di akhir)
4. Klik **Save**

> Tidak perlu menambahkan `FIREBASE_PROJECT_ID`, `SUPABASE_URL`, atau
> `SUPABASE_SERVICE_ROLE_KEY` — semuanya sudah otomatis terbaca.

---

## Langkah 4 — Deploy Edge Function

Jalankan di terminal VS Code (dari folder project):

```powershell
npx supabase login
npx supabase link --project-ref nginmiqjfzycvbbufbev
npx supabase functions deploy kirim-notif-ews
```

Berhasil bila muncul tulisan seperti `Deployed Functions on project nginmiqjfzycvbbufbev`.

Verifikasi di dashboard:
https://supabase.com/dashboard/project/nginmiqjfzycvbbufbev/functions

---

## Langkah 5 — Pastikan Database Webhook aktif

Webhook inilah yang memanggil Edge Function setiap ada laporan darurat masuk.

1. Buka https://supabase.com/dashboard/project/nginmiqjfzycvbbufbev/database/hooks
2. Jika **belum ada** hook bernama `ews-notif-trigger`, klik **Create a new hook**
   dan isi:
   - **Name:** `ews-notif-trigger`
   - **Table:** `ews_laporan_rt004`
   - **Events:** centang **Insert**
   - **Type:** `HTTP Request`
   - **Method:** `POST`
   - **URL:** `https://nginmiqjfzycvbbufbev.supabase.co/functions/v1/kirim-notif-ews`
   - **HTTP Headers:** tambahkan satu baris
     - Key: `Authorization`
     - Value: `Bearer <SUPABASE_ANON_KEY>`
       (ambil dari **Project Settings** → **API** → *anon public*)
3. Klik **Create webhook**

---

## Langkah 6 — Build & pasang ulang APK

**Ini wajib.** Izin `POST_NOTIFICATIONS` yang baru saya tambahkan hanya berlaku
pada APK yang dibangun ulang. APK lama di HP tidak akan pernah menerima
notifikasi walaupun Langkah 1–5 sudah benar.

```powershell
npm run build
npx cap sync android
cd android
.\gradlew assembleRelease
cd ..
```

APK hasilnya ada di:
`android\app\build\outputs\apk\release\E-RT04-v1.0.0-release.apk`

Lalu di HP:
1. **Uninstall** aplikasi E-RT04 versi lama (supaya izin ter-reset bersih)
2. Install APK baru
3. Buka aplikasi → saat muncul permintaan **"Izinkan notifikasi?"** pilih **Izinkan**

---

## Cara Menguji

1. Buka aplikasi di HP, lalu kirim satu laporan EWS percobaan
2. Buka log Edge Function:
   https://supabase.com/dashboard/project/nginmiqjfzycvbbufbev/functions/kirim-notif-ews/logs
3. Log yang benar terlihat seperti ini:
   ```
   📢 Laporan EWS baru: EWS-20260818-ABC123 — KEBAKARAN
   📱 Mengirim notifikasi ke 1 device...
   ✅ Notifikasi terkirim ke 1/1 device.
   ```

Untuk memastikan HP sudah terdaftar, jalankan query ini di
**SQL Editor** Supabase:

```sql
select token, device_info, created_at
from ews_fcm_tokens
order by created_at desc;
```

Kalau tabelnya kosong, berarti HP belum pernah berhasil mendaftar — biasanya
karena APK belum di-build ulang (Langkah 6) atau izin notifikasi ditolak.

---

## Bila Masih Gagal

| Pesan di log | Artinya | Solusi |
|---|---|---|
| `Secret FIREBASE_SERVICE_ACCOUNT belum di-set` | Langkah 3 terlewat | Ulangi Langkah 3 |
| `FIREBASE_SERVICE_ACCOUNT bukan JSON yang valid` | JSON terpotong saat di-paste | Salin ulang seluruh isi file |
| `400 invalid_grant` | private key rusak | Generate ulang key (Langkah 1) |
| `FCM error 401` | API belum aktif / kurang izin | Ulangi Langkah 2 |
| `No FCM tokens registered` | Belum ada HP terdaftar | Ulangi Langkah 6 |
| Log kosong sama sekali | Webhook tidak jalan | Periksa Langkah 5 |

Catatan: folder `android/` tidak ikut ter-push ke git (ada di `.gitignore`),
jadi izin `POST_NOTIFICATIONS` di `AndroidManifest.xml` ada di komputer ini saja.
Bila project di-clone ulang di komputer lain, tambahkan kembali dua baris ini
ke `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
```
