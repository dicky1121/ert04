# Panduan Build APK Android - SIP RT 004 Jatimulya

Dokumentasi lengkap untuk build dan distribusi aplikasi Android dari webapp SIP RT 004.

## Prerequisites

### Software yang Dibutuhkan

1. **Node.js** (v18+)
   - Download: https://nodejs.org/
   - Verifikasi: `node --version`

2. **Android Studio** (Arctic Fox atau lebih baru)
   - Download: https://developer.android.com/studio
   - Termasuk Android SDK, Build Tools, dan Emulator

3. **JDK 17** (Java Development Kit)
   - Sudah included di Android Studio atau download terpisah
   - Verifikasi: `java --version`

### Akun yang Dibutuhkan

1. **Supabase Account** (gratis)
   - URL project: https://supabase.com/dashboard
   - Database tables sudah di-setup via scripts/setup-ews.sql

2. **Firebase Account** (gratis)
   - URL project: https://console.firebase.google.com/
   - Untuk FCM (Firebase Cloud Messaging) push notification

---

## Langkah 1: Install Dependencies

Di terminal, masuk ke folder project:

```bash
cd "c:\Users\ADMIN OS\Desktop\sip3"
```

Install semua dependencies termasuk Capacitor:

```bash
npm install
```

Packages yang diinstall:
- `@capacitor/core` - Capacitor runtime
- `@capacitor/cli` - Capacitor CLI tools
- `@capacitor/android` - Android platform
- `@capacitor/push-notifications` - Push notification API
- `@capacitor/status-bar` - Status bar styling
- `@capacitor/splash-screen` - Splash screen control

---

## Langkah 2: Setup Firebase Project

### 2.1. Buat Firebase Project

1. Buka https://console.firebase.google.com/
2. Klik **Add project** (atau pilih project existing)
3. Nama project: `sip-rt004-jatimulya` (bebas)
4. Disable Google Analytics (opsional, tidak diperlukan)
5. Klik **Create project**

### 2.2. Tambah Android App ke Firebase

1. Di Firebase Console, klik icon **Android** (atau **Add app**)
2. Isi form:
   - **Android package name**: `id.go.bekasi.jatimulya.rt004` (WAJIB sama dengan capacitor.config.ts)
   - **App nickname**: `SIP RT 004` (opsional)
   - **Debug signing certificate SHA-1**: kosongkan dulu (untuk debug APK tidak wajib)
3. Klik **Register app**

### 2.3. Download google-services.json

1. Setelah registrasi, Firebase akan otomatis download `google-services.json`
2. Jika tidak otomatis, klik **Download google-services.json** di halaman tersebut
3. **SIMPAN FILE INI**, akan digunakan nanti setelah `npx cap add android`

### 2.4. Enable Firebase Cloud Messaging API

1. Di Firebase Console, klik icon ⚙️ (Settings) → **Project settings**
2. Tab **Cloud Messaging**
3. Jika diminta enable **Cloud Messaging API (Legacy)**, klik **Enable** (untuk HTTP v1 API)
4. Catat **Project ID** (contoh: `sip-rt004-jatimulya`)

### 2.5. Generate Firebase Access Token (untuk Supabase Edge Function)

**Untuk Development/Testing:**

Gunakan OAuth2 access token temporary (berlaku ~1 jam):

```bash
# Install Firebase CLI jika belum ada
npm install -g firebase-tools

# Login ke Firebase
firebase login

# Generate access token
firebase login:ci
```

Copy token yang dihasilkan (contoh: `1//0abcdef...xyz`). Token ini akan di-set sebagai secret di Supabase Edge Function.

**Untuk Production:**

Gunakan Service Account JSON dengan library `google-auth-library`. Lihat dokumentasi di `supabase/functions/kirim-notif-ews/README.md` bagian "Production Deployment".

---

## Langkah 3: Setup Supabase Database

### 3.1. Jalankan SQL Schema

1. Buka https://supabase.com/dashboard
2. Pilih project Anda → **SQL Editor** (menu kiri)
3. Klik **New query**
4. Copy-paste isi file `scripts/setup-ews.sql` ke editor
5. Klik **Run** (atau tekan F5)

Ini akan membuat:
- Tabel `ews_laporan_rt004` (untuk laporan darurat)
- Tabel `ews_fcm_tokens` (untuk FCM tokens device)
- RLS policies (anon user boleh INSERT laporan & token)

### 3.2. Deploy Edge Function

Edge Function `kirim-notif-ews` berfungsi menerima webhook dari Supabase saat ada laporan baru, lalu mengirim push notification ke semua device.

**Install Supabase CLI:**

```bash
npm install -g supabase
```

**Login ke Supabase:**

```bash
supabase login
```

**Link project lokal ke Supabase project:**

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

(Ganti `YOUR_PROJECT_REF` dengan ref project Anda, bisa dilihat di URL Supabase Dashboard)

**Deploy Edge Function:**

```bash
supabase functions deploy kirim-notif-ews
```

**Set Secrets (Environment Variables):**

```bash
# Firebase Project ID
supabase secrets set FIREBASE_PROJECT_ID=sip-rt004-jatimulya

# Firebase Access Token (dari firebase login:ci tadi)
supabase secrets set FIREBASE_ACCESS_TOKEN="1//0abcdef...xyz"
```

Verifikasi secrets tersimpan:

```bash
supabase secrets list
```

### 3.3. Setup Database Webhook

Database Webhook akan trigger Edge Function setiap kali ada INSERT baru ke tabel `ews_laporan_rt004`.

**Via Supabase Dashboard (Recommended):**

1. Buka https://supabase.com/dashboard
2. Pilih project → **Database** → **Webhooks** (menu kiri)
3. Klik **Create a new hook** atau **Enable Webhooks**
4. Isi form:
   - **Name**: `webhook_kirim_notif_ews`
   - **Table**: `ews_laporan_rt004`
   - **Events**: centang **Insert** saja
   - **Type**: **HTTP Request**
   - **Method**: **POST**
   - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/kirim-notif-ews`
     - Ganti `YOUR_PROJECT_REF` dengan ref project Anda
   - **HTTP Headers**:
     ```json
     {
       "Content-Type": "application/json",
       "Authorization": "Bearer YOUR_ANON_KEY"
     }
     ```
     - Ganti `YOUR_ANON_KEY` dengan anon key project (bisa dilihat di Settings → API)
5. Klik **Create webhook**

**Test Webhook:**

Setelah webhook dibuat, test dengan INSERT manual di SQL Editor:

```sql
INSERT INTO ews_laporan_rt004 (jenis_kejadian, deskripsi, nama_pelapor, alamat, status)
VALUES ('kebakaran', 'Test notifikasi', 'Admin Test', 'Jl. Test No. 1', 'baru');
```

Cek logs Edge Function:

```bash
supabase functions logs kirim-notif-ews
```

Jika berhasil, akan muncul log seperti:

```
[kirim-notif-ews] Received webhook: {...}
[kirim-notif-ews] FCM tokens found: 2
[kirim-notif-ews] FCM send result: {...}
```

---

## Langkah 4: Build React App

Build webapp menjadi static files (HTML, CSS, JS):

```bash
npm run build
```

Output akan ada di folder `dist/`. Verifikasi folder ini ada sebelum lanjut.

---

## Langkah 5: Add Android Platform

Jalankan Capacitor untuk generate folder `android/`:

```bash
npx cap add android
```

Folder `android/` akan di-generate otomatis berisi project Android Studio.

---

## Langkah 6: Copy google-services.json

Copy file `google-services.json` yang sudah didownload dari Firebase (Langkah 2.3) ke folder Android:

**Windows:**

```powershell
Copy-Item "C:\Users\ADMIN OS\Downloads\google-services.json" "c:\Users\ADMIN OS\Desktop\sip3\android\app\google-services.json"
```

**atau manual:**

1. Buka Windows Explorer
2. Copy file `google-services.json` dari Downloads
3. Paste ke `c:\Users\ADMIN OS\Desktop\sip3\android\app\`

**Verifikasi path:**

```
android/
  app/
    google-services.json  <-- file harus ada di sini
    build.gradle
    src/
```

---

## Langkah 7: Sync Capacitor

Sync perubahan dari webapp ke Android project:

```bash
npm run cap:sync
```

Command ini akan:
1. Copy folder `dist/` ke `android/app/src/main/assets/public/`
2. Update plugin configurations
3. Install Capacitor plugins di native code

---

## Langkah 8: Build APK di Android Studio

### 8.1. Buka Android Studio

```bash
npm run cap:open
```

Android Studio akan terbuka otomatis dengan project di folder `android/`.

### 8.2. Sync Gradle (jika belum otomatis)

1. Di Android Studio, klik **File → Sync Project with Gradle Files**
2. Tunggu proses selesai (download dependencies ~5-10 menit pertama kali)
3. Jika ada error, klik **Build → Clean Project**, lalu **Build → Rebuild Project**

### 8.3. Build APK Debug (untuk Testing)

**Via Android Studio:**

1. Klik **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Tunggu proses build (~3-5 menit)
3. Setelah selesai, klik notifikasi **locate** atau **open**
4. APK akan ada di: `android/app/build/outputs/apk/debug/app-debug.apk`

**Via Terminal:**

```bash
npm run android:build
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### 8.4. Build APK Release (untuk Distribusi)

APK release lebih kecil dan optimized, tapi perlu signing dengan keystore.

**A. Generate Keystore (hanya sekali):**

```bash
keytool -genkey -v -keystore sip-rt004-release.keystore -alias sip-rt004 -keyalg RSA -keysize 2048 -validity 10000
```

Isi form:
- **Keystore password**: buat password (CATAT BAIK-BAIK!)
- **Re-enter password**: ulangi password
- **What is your first and last name?**: `RT 004 Jatimulya`
- **What is the name of your organizational unit?**: `RT 004`
- **What is the name of your organization?**: `Kelurahan Jatimulya`
- **What is the name of your City or Locality?**: `Bekasi`
- **What is the name of your State or Province?**: `Jawa Barat`
- **What is the two-letter country code for this unit?**: `ID`

Keystore akan di-generate di folder saat ini: `sip-rt004-release.keystore`

**PENTING:** Simpan file keystore dan password dengan aman! Jika hilang, tidak bisa update app di masa depan.

**B. Konfigurasi Gradle untuk Signing:**

Edit file `android/app/build.gradle`, tambahkan sebelum `android { ... }`:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Lalu di dalam `android { ... }`, tambahkan `signingConfigs` sebelum `buildTypes`:

```gradle
android {
    ...
    
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    
    ...
}
```

**C. Buat file keystore.properties:**

Buat file `android/keystore.properties` dengan isi:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEYSTORE_PASSWORD
keyAlias=sip-rt004
storeFile=../../sip-rt004-release.keystore
```

(Ganti `YOUR_KEYSTORE_PASSWORD` dengan password yang dibuat tadi)

**D. Build APK Release:**

```bash
npm run android:release
```

atau di Android Studio:

1. Klik **Build → Generate Signed Bundle / APK**
2. Pilih **APK** → Next
3. Pilih keystore file, isi password, pilih alias → Next
4. Pilih **release** → Finish

Output: `android/app/build/outputs/apk/release/app-release.apk`

**E. Verifikasi APK Size:**

APK debug: ~15-20 MB
APK release: ~8-12 MB (lebih kecil karena optimized)

---

## Langkah 9: Test APK di Device

### 9.1. Install APK ke Device Fisik

**Via USB Cable:**

1. Enable **Developer Options** di Android:
   - Settings → About Phone → tap **Build Number** 7 kali
2. Enable **USB Debugging**:
   - Settings → Developer Options → USB Debugging (ON)
3. Hubungkan device ke PC via USB
4. Di terminal:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```
5. Jika diminta "Allow USB debugging?", tap **OK**

**Via WhatsApp/File Sharing:**

1. Copy APK ke Google Drive atau OneDrive
2. Share link ke HP Android
3. Download APK di HP
4. Tap file APK → Install
5. Jika muncul "Install blocked", tap **Settings** → enable **Install unknown apps**

### 9.2. Test Fitur EWS

**Test Form Laporan:**

1. Buka app di Android
2. Halaman **Sapa Warga** → tap tombol **🚨 Laporkan Darurat**
3. Isi form:
   - Jenis Kejadian: Kebakaran
   - Deskripsi: Test laporan dari app
   - Nama: Warga RT 004
   - Alamat: Jl. Test No. 1
   - Foto: (opsional)
4. Tap **Kirim Laporan**
5. Notification harus masuk ke semua device (termasuk device lain jika ada)

**Test Notification:**

1. Pastikan device #1 sudah login & install app
2. Dari device #2 (atau browser), kirim laporan EWS
3. Device #1 harus menerima notification (bahkan jika app tertutup)
4. Tap notification → app terbuka di tab **EWS Darurat**

**Test Dashboard Admin:**

1. Login sebagai pengurus di app
2. Tab **EWS Darurat** → lihat riwayat laporan
3. Filter by status/jenis
4. Update status laporan
5. Verifikasi realtime update (jika ada device lain yang buka dashboard)

---

## Langkah 10: Distribusi APK ke Warga

Karena ini internal RT (bukan Play Store), distribusi via:

### Opsi 1: WhatsApp Group

1. Upload APK ke Google Drive/OneDrive
2. Set permission: **Anyone with the link can view**
3. Copy link
4. Kirim ke grup WA RT 004:
   ```
   📱 Aplikasi SIP RT 004 Jatimulya - Android
   
   Link download APK:
   https://drive.google.com/file/d/xxx/view
   
   Cara install:
   1. Download file APK
   2. Tap file APK
   3. Jika muncul "Install blocked", klik Settings → enable "Install unknown apps" untuk browser/Chrome
   4. Tap Install
   
   Fitur baru: 🚨 Laporan Darurat (EWS)
   - Laporkan kejadian darurat (kebakaran, banjir, kecelakaan, dll)
   - Notifikasi otomatis ke semua warga
   - Dashboard realtime untuk pengurus
   
   Size: ~10 MB
   Versi: 1.0.0
   Gratis, tidak ada iklan
   ```

### Opsi 2: Telegram/Diskusi Online

Upload APK ke Telegram channel/group dengan caption serupa.

### Opsi 3: QR Code

Generate QR code dari link Google Drive, cetak & tempel di papan pengumuman RT.

---

## Maintenance & Update

### Update App (New Version)

1. Edit code di `src/`
2. Update `version` di `package.json` (contoh: `"version": "1.0.1"`)
3. Update `version` di `android/app/build.gradle`:
   ```gradle
   versionCode 2
   versionName "1.0.1"
   ```
4. Build ulang:
   ```bash
   npm run build
   npm run cap:sync
   npm run android:release
   ```
5. Distribusi APK baru dengan instruksi "Uninstall app lama, install app baru"

### Monitoring

**Check Logs Edge Function:**

```bash
supabase functions logs kirim-notif-ews --tail
```

**Check Database:**

1. Supabase Dashboard → **Table Editor**
2. Lihat tabel `ews_laporan_rt004` untuk laporan baru
3. Lihat tabel `ews_fcm_tokens` untuk jumlah device terdaftar

---

## Troubleshooting

### Build Error: "google-services.json not found"

**Penyebab:** File `google-services.json` tidak ada di `android/app/`.

**Solusi:**
1. Download ulang dari Firebase Console
2. Copy ke `android/app/google-services.json`
3. Sync Gradle: **File → Sync Project with Gradle Files**

### Build Error: "Execution failed for task ':app:processDebugGoogleServices'"

**Penyebab:** Package name di `google-services.json` tidak cocok dengan `applicationId` di `build.gradle`.

**Solusi:**
1. Verifikasi `android/app/build.gradle`:
   ```gradle
   applicationId "id.go.bekasi.jatimulya.rt004"
   ```
2. Verifikasi `google-services.json`:
   ```json
   "client": [{
     "client_info": {
       "android_client_info": {
         "package_name": "id.go.bekasi.jatimulya.rt004"
       }
     }
   }]
   ```
3. Jika tidak cocok, download ulang `google-services.json` dari Firebase dengan package name yang benar

### APK Install Failed: "App not installed"

**Penyebab:** Ada versi app lama dengan signature berbeda.

**Solusi:**
1. Uninstall app lama di device
2. Install APK baru

### Notification Tidak Masuk

**Checklist:**
1. ✅ FCM token terdaftar di tabel `ews_fcm_tokens` (cek via Supabase Dashboard)
2. ✅ Edge Function deployed dan secrets tersimpan (cek `supabase secrets list`)
3. ✅ Database Webhook configured (cek Supabase Dashboard → Database → Webhooks)
4. ✅ Device enable notifikasi untuk app (Settings → Apps → SIP RT 004 → Notifications)
5. ✅ Test manual kirim notification via Firebase Console

### App Crash saat Dibuka

**Penyebab:** Error di JavaScript atau native code.

**Solusi:**
1. Cek Logcat di Android Studio (klik **Logcat** tab di bawah)
2. Filter by package: `id.go.bekasi.jatimulya.rt004`
3. Lihat error stack trace
4. Jika error "Default FirebaseApp is not initialized", pastikan `google-services.json` ada

---

## File Penting (Backup!)

**WAJIB di-backup:**

1. `sip-rt004-release.keystore` - Keystore untuk signing APK release
2. `android/keystore.properties` - Credential keystore
3. `google-services.json` - Firebase configuration
4. Password keystore (simpan di password manager)

**JANGAN di-commit ke Git:**

- `android/keystore.properties`
- `sip-rt004-release.keystore`
- `google-services.json` (jika private project)

Sudah ada di `.gitignore`:
```
android/
google-services.json
*.keystore
keystore.properties
```

---

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Android Developer Guide](https://developer.android.com/guide)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

## Support

Jika ada kendala teknis:
1. Cek dokumentasi ini
2. Cek file `CAPACITOR_SETUP.md` untuk setup awal
3. Cek file `PUSH_NOTIFICATION_SETUP.md` untuk troubleshooting notifikasi
4. Cek logs: `supabase functions logs kirim-notif-ews`

---

**Happy Building! 🚀**

Build date: 2026-08-17
App version: 1.0.0
Target: Android 8.0+ (API 26+)
