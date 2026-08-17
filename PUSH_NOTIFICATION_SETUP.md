# Push Notification Setup untuk Android

Panduan lengkap setup push notification FCM (Firebase Cloud Messaging) di aplikasi Android Capacitor.

## Overview

Alur kerja push notification EWS:

```
Warga kirim laporan EWS
  ↓
Supabase: INSERT ke ews_laporan_rt004
  ↓
Database Webhook trigger Edge Function
  ↓
Edge Function kirim ke FCM
  ↓
FCM push notification ke semua device Android (bahkan saat app tertutup)
  ↓
pushNotificationService.ts handle notification:
  - Foreground: tampilkan toast
  - Background/tapped: navigasi ke tab EWS
```

## File yang Sudah Dibuat

✅ **src/services/pushNotificationService.ts**
- Request permission notifikasi
- Registrasi FCM token ke Supabase
- Setup Android Notification Channel `ews_darurat` (IMPORTANCE_HIGH)
- Handle notification foreground & background
- Navigate ke tab EWS saat notification di-tap

✅ **src/main.tsx**
- Inisialisasi `pushNotificationService.init()` saat app dibuka
- Setup StatusBar & SplashScreen

✅ **src/App.tsx**
- Event listener `ews-notification-tapped` → navigasi ke tab EWS
- Event listener `ews-notification-foreground` → toast notification

✅ **src/capacitor-shim.d.ts**
- TypeScript declarations untuk Capacitor plugins (temporary, akan diganti oleh package asli setelah npm install)

## Setup Android Native (MainActivity.java)

Setelah `npx cap add android`, buka file berikut:

**Path:** `android/app/src/main/java/id/go/bekasi/jatimulya/rt004/MainActivity.java`

**Isi file:**

```java
package id.go.bekasi.jatimulya.rt004;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Notification channel sudah di-setup via pushNotificationService.ts
        // via PushNotifications.createChannel() — tidak perlu kode Java tambahan
    }
}
```

File ini sudah otomatis di-generate oleh Capacitor dengan kode minimal. Tidak perlu modifikasi.

## Setup Android Manifest Permissions

**Path:** `android/app/src/main/AndroidManifest.xml`

Pastikan file ini memiliki permissions berikut (sudah otomatis ditambahkan oleh Capacitor plugin):

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:label="@string/app_name"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:windowSoftInputMode="adjustResize">
            
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        
    </application>
</manifest>
```

File ini sudah otomatis di-generate. **Tidak perlu modifikasi manual.**

## Setup google-services.json

**PENTING:** File `google-services.json` dari Firebase **wajib ada** di:

```
android/app/google-services.json
```

Cara dapatkan file ini:

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project Firebase
3. Klik icon ⚙️ (Settings) → Project settings
4. Tab **General** → scroll ke **Your apps**
5. Pilih Android app (Package name: `id.go.bekasi.jatimulya.rt004`)
6. Download **google-services.json**
7. Copy file ke `android/app/google-services.json`

**Jika file tidak ada**, app akan crash saat pertama dibuka dengan error:

```
Default FirebaseApp is not initialized
```

## Testing Push Notification

### 1. Build & Run App di Android

```bash
npm run cap:sync
npm run cap:open
```

Di Android Studio, klik **Run** (▶️).

### 2. Verifikasi FCM Token Terdaftar

Saat app pertama dibuka, cek Logcat di Android Studio:

```
[PushNotif] Initializing...
[PushNotif] Channel "ews_darurat" created
[PushNotif] Permission granted
[PushNotif] FCM Token: fR3aB...xyz (panjang ~150 karakter)
[PushNotif] Token registered to Supabase
[PushNotif] Initialization complete
```

Verifikasi token tersimpan di Supabase:

1. Buka **Supabase Dashboard** → **Table Editor**
2. Pilih tabel `ews_fcm_tokens`
3. Pastikan ada row baru dengan `token` = token dari Logcat

### 3. Test Kirim Notification Manual via Firebase Console

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project → **Cloud Messaging** (menu kiri)
3. Klik **Send your first message** atau **New campaign**
4. Isi:
   - **Notification title**: `🚨 Test EWS`
   - **Notification text**: `Ini notifikasi test dari Firebase Console`
   - **Target**: pilih **Single device**, paste FCM token dari Logcat
5. Klik **Send test message**

Notification harus muncul di device Android (bahkan jika app tertutup).

### 4. Test EWS End-to-End

1. Buka app di Android → halaman **Sapa Warga**
2. Klik tombol **🚨 Laporkan Darurat**
3. Isi form EWS, submit
4. Notification harus masuk ke device (termasuk device lain yang install app)
5. Tap notification → app terbuka di tab **EWS Darurat** dashboard admin

## Notification Channel Settings

User Android bisa customize notification di:

**Settings → Apps → SIP RT 004 Jatimulya → Notifications → EWS Darurat RT 004**

Di sini user bisa:
- Enable/disable notifikasi
- Ubah bunyi notifikasi
- Ubah vibration pattern
- Ubah visibility (lock screen)

Channel `ews_darurat` sudah di-set dengan:
- **Importance**: High (muncul sebagai heads-up notification)
- **Sound**: Default
- **Vibration**: Enabled
- **Visibility**: Public (muncul di lock screen)

## Troubleshooting

### Error: "Default FirebaseApp is not initialized"

**Penyebab:** File `google-services.json` tidak ada atau salah path.

**Solusi:**
1. Pastikan file ada di `android/app/google-services.json`
2. Jalankan `npm run cap:sync` ulang
3. Di Android Studio, klik **File → Sync Project with Gradle Files**
4. Clean & rebuild: **Build → Clean Project**, lalu **Build → Rebuild Project**

### FCM Token tidak muncul di Logcat

**Penyebab:** Permission notifikasi ditolak user atau Firebase belum dikonfigurasi.

**Solusi:**
1. Uninstall app dari device
2. Verifikasi `google-services.json` sudah ada
3. Rebuild & install ulang app
4. Saat diminta permission notifikasi, klik **Allow**

### Notification tidak masuk ke device

**Checklist:**
1. ✅ FCM token terdaftar di tabel `ews_fcm_tokens`
2. ✅ Supabase Edge Function `kirim-notif-ews` sudah di-deploy
3. ✅ Database Webhook sudah dikonfigurasi di Supabase Dashboard
4. ✅ Firebase secret `FIREBASE_ACCESS_TOKEN` sudah di-set di Edge Function
5. ✅ User Android enable notifikasi untuk app (Settings → Apps → Notifications)

### Notification muncul tapi tidak berbunyi

**Penyebab:** Channel settings di-customize oleh user atau HP di mode silent.

**Solusi:**
1. Cek HP tidak di mode **Do Not Disturb**
2. Settings → Apps → SIP RT 004 → Notifications → EWS Darurat RT 004
3. Pastikan **Sound** tidak di-set ke **None**

### Notification di-tap tapi tidak navigasi ke tab EWS

**Penyebab:** Event listener belum terpasang atau data payload tidak sesuai.

**Solusi:**
1. Cek Logcat saat tap notification:
   ```
   [PushNotif] Action performed: ...
   [PushNotif] EWS notification tapped, laporan_id: EWS-20260817-ABC123
   ```
2. Verifikasi Edge Function mengirim payload dengan `data.type = "EWS"`
3. Verifikasi `App.tsx` memiliki event listener `ews-notification-tapped`

## TypeScript Errors (Before npm install)

Jika ada error TypeScript seperti:

```
Cannot find module '@capacitor/core'
Cannot find module '@capacitor/push-notifications'
```

Ini normal karena package belum diinstall. Jalankan:

```bash
npm install
```

File `src/capacitor-shim.d.ts` (temporary type declarations) akan otomatis tidak digunakan setelah package asli terinstall.

## Next Steps

Setelah push notification berhasil:

1. **Task 8**: Polish UI, generate icon & splash screen, build APK release
2. Deploy Edge Function ke Supabase: `npx supabase functions deploy kirim-notif-ews`
3. Setup Database Webhook di Supabase Dashboard
4. Distribute APK ke warga RT via WhatsApp atau Google Drive

## Reference

- [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Android Notification Channels](https://developer.android.com/training/notify-user/channels)
