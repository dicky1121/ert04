# Setup Capacitor untuk Android

Panduan lengkap mengkonversi webapp SIP RT 004 menjadi aplikasi Android native menggunakan Capacitor.

## Prerequisites

1. **Node.js & npm** — sudah terinstall
2. **Android Studio** — download dari https://developer.android.com/studio
   - Saat install, pastikan centang:
     - Android SDK
     - Android SDK Platform
     - Android Virtual Device (AVD) — untuk emulator
3. **Java JDK 17** — biasanya sudah terinstall bersama Android Studio
4. **Gradle** — sudah included di Android Studio

## Step 1: Install Capacitor Dependencies

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/push-notifications @capacitor/status-bar @capacitor/splash-screen --save
```

Ini akan menginstall:
- `@capacitor/core` — Core Capacitor runtime
- `@capacitor/cli` — CLI tools untuk generate & sync project
- `@capacitor/android` — Android platform support
- `@capacitor/push-notifications` — Plugin push notification FCM
- `@capacitor/status-bar` — Plugin untuk styling status bar
- `@capacitor/splash-screen` — Plugin splash screen

## Step 2: Verify Config

File `capacitor.config.ts` sudah dibuat dengan konfigurasi:
- **App ID**: `id.go.bekasi.jatimulya.rt004`
- **App Name**: `SIP RT 004 Jatimulya`
- **Web Dir**: `dist` (output folder Vite build)
- **Splash Screen**: Background dark slate-950, spinner emerald-500
- **Status Bar**: Style dark, background slate-950

## Step 3: Build Web App

Sebelum add platform Android, build dulu React app:

```bash
npm run build
```

Output akan masuk ke folder `dist/`.

## Step 4: Add Android Platform

```bash
npx cap add android
```

atau pakai npm script:

```bash
npm run cap:add:android
```

Ini akan:
1. Generate folder `android/` berisi project Android Studio native
2. Copy file `dist/` ke `android/app/src/main/assets/public/`
3. Generate konfigurasi awal

**CATATAN:** Proses ini butuh waktu 1-2 menit.

## Step 5: Sync Web Assets ke Android

Setiap kali ada perubahan code React, jalankan:

```bash
npm run cap:sync
```

Ini akan:
1. Build React app (`npm run build`)
2. Copy hasil build ke Android assets
3. Update plugin native jika ada perubahan

## Step 6: Setup Firebase untuk Push Notification

### 6.1. Buat Firebase Project

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Klik **Add project** atau **Create a project**
3. Nama project: `SIP RT 004 Jatimulya` (atau bebas)
4. Ikuti wizard sampai project dibuat

### 6.2. Add Android App ke Firebase Project

1. Di Firebase Console, pilih project yang baru dibuat
2. Klik icon Android (Add app) di halaman overview
3. Isi form:
   - **Android package name**: `id.go.bekasi.jatimulya.rt004` (HARUS SAMA dengan appId di capacitor.config.ts)
   - **App nickname**: `SIP RT 004` (opsional)
   - **Debug signing certificate SHA-1**: kosongkan dulu (untuk development)
4. Klik **Register app**

### 6.3. Download google-services.json

1. Setelah register app, Firebase akan tawarkan download `google-services.json`
2. Klik **Download google-services.json**
3. Copy file tersebut ke folder: `android/app/`

**Path final:** `android/app/google-services.json`

### 6.4. Verify Firebase Config

File `google-services.json` sudah otomatis di-load oleh Android build system. Tidak perlu konfigurasi tambahan.

## Step 7: Open Android Project di Android Studio

```bash
npx cap open android
```

atau pakai npm script:

```bash
npm run cap:open
```

Ini akan membuka Android Studio dengan project di folder `android/`.

**First-time setup di Android Studio:**
1. Android Studio akan download SDK & dependencies (bisa 5-10 menit)
2. Tunggu sampai Gradle sync selesai (lihat progress bar di bawah)
3. Jika ada prompt "Upgrade Gradle Plugin", klik **Don't remind me again**

## Step 8: Run di Emulator atau Device

### Opsi A: Run di Android Emulator

1. Di Android Studio, klik **Device Manager** (icon HP di toolbar)
2. Klik **Create Device**
3. Pilih **Phone** → **Pixel 5** (atau device lain) → **Next**
4. Download system image **Android 13 (Tiramisu) API 33** → **Next** → **Finish**
5. Di toolbar, pilih emulator yang baru dibuat
6. Klik tombol **Run** (▶️ hijau) atau tekan `Shift + F10`

App akan build dan launch di emulator (~2-3 menit first build).

### Opsi B: Run di Device Fisik Android

1. Aktifkan **Developer Options** di HP Android:
   - Settings → About phone → tap **Build number** 7 kali
2. Settings → Developer options → aktifkan **USB debugging**
3. Sambungkan HP ke komputer via USB
4. Di Android Studio, pilih device fisik di dropdown toolbar
5. Klik **Run** (▶️)

## Step 9: Test Fitur EWS

1. App terbuka di Android
2. Halaman **Sapa Warga** akan menampilkan tombol **🚨 Laporkan Darurat** (hanya di Android, tidak muncul di browser)
3. Klik tombol, isi form EWS, submit
4. Notifikasi push akan masuk ke semua device yang install app (setelah Firebase + Supabase webhook dikonfigurasi)

## Troubleshooting

### Error: "SDK location not found"
- Buka `android/local.properties`
- Tambahkan: `sdk.dir=C\:\\Users\\ADMIN OS\\AppData\\Local\\Android\\Sdk` (sesuaikan path)

### Error: "google-services.json not found"
- Pastikan file ada di `android/app/google-services.json`
- Jangan taruh di `android/` atau `android/app/src/`

### App crash saat dibuka
- Cek logcat di Android Studio (tab **Logcat** di bawah)
- Biasanya karena missing permission atau plugin belum dikonfigurasi

### Push notification tidak masuk
- Pastikan `google-services.json` sudah ditambahkan
- Pastikan Supabase Edge Function sudah di-deploy
- Pastikan Database Webhook sudah dikonfigurasi
- Cek tab **Task 7** untuk setup pushNotificationService

### Build error "Could not resolve @capacitor/core"
- Jalankan `npm install` lagi
- Hapus `node_modules/` dan `package-lock.json`, lalu `npm install` ulang

## Next Steps

Setelah Android project berhasil di-build:

1. **Task 7**: Implementasi `pushNotificationService.ts` untuk handle FCM token & notification
2. **Task 8**: Polish UI mobile, generate icon & splash screen, build APK release

## NPM Scripts Reference

```bash
# Sync perubahan code ke Android
npm run cap:sync

# Buka Android Studio
npm run cap:open

# Build + sync + run di device
npm run cap:run

# Build APK debug (tanpa Android Studio)
npm run android:build
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Build APK release (untuk distribusi)
npm run android:release
# Output: android/app/build/outputs/apk/release/app-release-unsigned.apk
```

## File Structure Setelah Setup

```
sip3/
├── android/                  ← Android native project (generated)
│   ├── app/
│   │   ├── src/
│   │   ├── google-services.json  ← PENTING: file dari Firebase
│   │   └── build.gradle
│   ├── gradle/
│   └── build.gradle
├── capacitor.config.ts       ← Capacitor config
├── dist/                     ← Vite build output
├── src/                      ← React source code
└── package.json              ← npm scripts untuk Capacitor
```
