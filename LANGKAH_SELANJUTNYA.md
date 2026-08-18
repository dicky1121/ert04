# Apa yang Harus Saya Lakukan Sekarang?

Dokumen ini menjawab pertanyaan itu secara berurutan. Kerjakan dari atas ke bawah.
Yang sudah beres tidak perlu diulang.

## Sudah selesai (tidak perlu diapa-apakan)

| Item | Status |
|---|---|
| JDK 17 terpasang | Selesai (Temurin 17.0.20) |
| APK debug | Selesai |
| Keystore release + signing config | Selesai |
| APK release tertandatangani | Selesai — 4.18 MB |
| Tabel `ews_laporan_rt004`, `ews_fcm_tokens` | Selesai |

APK siap pakai ada di:

```
android\app\build\outputs\apk\release\E-RT04-v1.0.0-release.apk
```

---

## LANGKAH 1 — Backup keystore (5 menit, PALING PENTING)

Kalau file keystore hilang, Anda **tidak bisa lagi mengirim update aplikasi** ke warga
selamanya. Mereka harus uninstall lalu install ulang dari nol. Jadi ini dulu.

```
powershell -ExecutionPolicy Bypass -File scripts\backup-keystore.ps1
```

Script akan menyalin keystore, `keystore.properties`, `google-services.json`, dan catatan
password ke `Documents\Backup-ERT04-Keystore`, lalu membuka foldernya.

**Tugas manual Anda:** upload folder itu ke Google Drive pribadi **dan** copy ke flashdisk.
Minimal dua tempat. Jangan pernah kirim file ini ke grup WhatsApp atau GitHub.

---

## LANGKAH 2 — Jalankan patch SQL di Supabase (3 menit)

Ini yang memperbaiki error "row-level security policy" saat warga mengirim laporan
berikut foto.

1. Buka <https://supabase.com/dashboard> → pilih project Anda
2. Menu kiri: **SQL Editor** → **New query**
3. Buka file `scripts\perbaiki-ews-rls.sql`, copy **seluruh** isinya, paste ke editor
4. Klik **Run**

**Hasil yang benar:** muncul tabel 8 baris, kolom `status` semuanya `OK`.

Kalau ada baris `GAGAL`, kirimkan tangkapan layarnya ke saya.

---

## LANGKAH 3 — Pasang APK ke HP & uji dasar (10 menit)

Pakai HP Android Anda sendiri lebih dulu, jangan langsung sebar ke warga.

**Cara paling mudah** — kirim APK ke diri sendiri:
1. Buka WhatsApp Web di PC → chat ke nomor sendiri
2. Lampirkan `E-RT04-v1.0.0-release.apk` (lokasi di atas)
3. Buka WhatsApp di HP → unduh → ketuk file
4. Kalau muncul "Install blocked": ketuk **Settings** → aktifkan **Install unknown apps** → kembali → **Install**

**Yang harus diuji:**
- [ ] Aplikasi terbuka, halaman Sapa Warga muncul
- [ ] Ada tombol merah **"Laporkan Darurat"** di halaman Sapa Warga
- [ ] Saat pertama dibuka, minta izin notifikasi → ketuk **Allow**
- [ ] Coba kirim satu laporan darurat lengkap dengan foto → harus muncul pesan berhasil
- [ ] Login sebagai pengurus → menu **EWS Darurat** → laporan tadi tampil
- [ ] Coba ubah status laporan menjadi **DITANGANI**

Kalau semuanya berhasil, fitur EWS sudah jalan **kecuali push notification**
(itu Langkah 4). Laporan tetap masuk dan terlihat di dashboard pengurus.

---

## LANGKAH 4 — Push notification (30 menit, boleh ditunda)

Ini yang membuat HP pengurus **berbunyi otomatis** saat ada laporan darurat masuk.
Tanpa ini, pengurus harus membuka aplikasi untuk melihat laporan baru.

Kalau ingin dikerjakan, panduan lengkap ada di `PLAN_LENGKAP_BUILD_ANDROID.txt`
**Langkah 5 dan 6**. Ringkasnya:

```bash
npm install -g supabase
supabase login
supabase link --project-ref PROJECT_REF_ANDA
supabase functions deploy kirim-notif-ews
supabase secrets set FIREBASE_PROJECT_ID=...
supabase secrets set FIREBASE_ACCESS_TOKEN="..."
```

Lalu buat Database Webhook di Supabase Dashboard (Database → Webhooks) yang memanggil
Edge Function tersebut setiap ada INSERT ke `ews_laporan_rt004`.

**Catatan penting:** `FIREBASE_ACCESS_TOKEN` dari `firebase login:ci` hanya berlaku
sekitar 1 jam. Untuk pemakaian jangka panjang perlu Service Account JSON — lihat
`supabase/functions/kirim-notif-ews/README.md`.

Bilang saja kalau mau saya bantu bagian ini, saya bisa siapkan scriptnya.

---

## LANGKAH 5 — Sebar ke warga RT 004 (setelah Langkah 3 lulus)

1. Upload `E-RT04-v1.0.0-release.apk` ke Google Drive
2. Klik kanan file → **Share** → ubah ke **"Anyone with the link"** → copy link
3. Kirim ke grup WhatsApp RT. Contoh pesan siap pakai ada di
   `PLAN_LENGKAP_BUILD_ANDROID.txt` **Langkah 9**

Pantau jumlah pemasangan lewat tabel `ews_fcm_tokens` di Supabase — satu baris
kira-kira satu HP.

---

## Rekomendasi saya

Kerjakan **Langkah 1, 2, dan 3 hari ini** (total sekitar 20 menit). Setelah itu
aplikasi sudah benar-benar bisa dipakai.

Langkah 4 (push notification) dan Langkah 5 (sebar ke warga) bisa menyusul,
karena Langkah 4 melibatkan token Firebase yang perlu perhatian khusus.

---

## Perintah yang sering dipakai

```bash
# Verifikasi APK release masih utuh & tertandatangani
powershell -ExecutionPolicy Bypass -File scripts\cek-apk-release.ps1

# Backup keystore
powershell -ExecutionPolicy Bypass -File scripts\backup-keystore.ps1

# Build ulang setelah ubah kode
npm run cap:sync
npm run android:release

# Cek error TypeScript
npm run lint
```

Untuk membuat versi baru nanti: naikkan `versionCode` dan `versionName` di
`android\app\build.gradle`, baru build ulang. Kalau `versionCode` tidak dinaikkan,
APK baru tidak bisa dipasang menimpa yang lama.
