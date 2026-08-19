# Perbaikan: Notifikasi Tidak Masuk di HP

Keluhan: *"data masuk ke EWS darurat, tetapi tidak ada notifikasi yang masuk
di HP user yang menginstal aplikasi."*

---

## Penyebab yang ditemukan

### Penyebab utama: APK di HP masih berisi kode LAMA

Kode perbaikan notifikasi sudah ada di file sumber (`src/`), tetapi **belum
pernah dimasukkan ke dalam APK**. Aplikasi Android tidak membaca folder `src/`
— ia membaca hasil build di `android/app/src/main/assets/public/`. Folder itu
hanya diperbarui oleh perintah `npm run build` + `npx cap sync android`.

Bukti sebelum diperbaiki (`scripts/cek-bundle-notif.ps1`):

```
Bundle aktif : index-dmCDUgxF.js
  [KURANG] Listener dipasang sebelum register()
  [KURANG] Pelaporan kegagalan simpan token
  [KURANG] Pendaftaran token via RPC
  [KURANG] Pintu diagnosa dari DevTools
HASIL: 4 penanda tidak ditemukan - APK memakai kode LAMA.
```

Akibatnya HP tidak pernah mendaftarkan token, tabel `ews_fcm_tokens` tetap
kosong, dan Edge Function tidak punya tujuan pengiriman. Laporan darurat tetap
tersimpan (itulah sebabnya data terlihat masuk), tetapi tidak ada HP yang
dituju sehingga tidak ada notifikasi yang berbunyi.

### Penyebab kedua: fungsi `daftar_fcm_token` belum ada di database

Aplikasi memanggil RPC `daftar_fcm_token` sebagai jalur utama penyimpanan
token. Fungsi itu belum pernah dibuat, jadi pendaftaran token selalu bergantung
pada jalur cadangan yang bisa gagal diam-diam tanpa pesan error.

---

## Yang sudah dikerjakan

| Berkas | Guna |
| --- | --- |
| `scripts/cek-bundle-notif.ps1` | Memastikan kode perbaikan masuk ke folder build |
| `scripts/cek-isi-apk-notif.ps1` | Membuka isi APK & memastikan kode ikut terpasang |
| `scripts/aktifkan-rpc-fcm-token.sql` | Membuat fungsi `daftar_fcm_token` yang belum ada |
| `scripts/diagnosa-notifikasi-ews.sql` | Memeriksa 7 mata rantai notifikasi sekaligus |
| `src/components/StatusNotifikasiPanel.tsx` | Panel status notifikasi langsung di aplikasi |
| `src/components/EWSAdminView.tsx` | Menampilkan panel tersebut di halaman EWS Darurat |

Bundle sudah dibangun ulang dan diverifikasi:

```
Bundle aktif : index-CMOtteZZ.js
  [ADA] Listener dipasang sebelum register()
  [ADA] Pelaporan kegagalan simpan token
  [ADA] Pendaftaran token via RPC
  [ADA] Channel notifikasi ews_darurat
  [ADA] Penanganan registrationError
  [ADA] Pintu diagnosa dari DevTools
HASIL: bundle sudah memuat seluruh kode perbaikan notifikasi.
```

APK release baru sudah dibongkar dan diperiksa isinya:

```
APK    : E-RT04-v1.0.0-release.apk (4.19 MB)
Bundle di dalam APK : assets/public/assets/index-CMOtteZZ.js
  [ADA] Listener dipasang sebelum register()
  [ADA] Pelaporan kegagalan simpan token
  [ADA] Pendaftaran token via RPC
  [ADA] Channel notifikasi ews_darurat
  [ADA] Penanganan registrationError
  [ADA] Panel status notifikasi di aplikasi
  [ADA] Tombol daftarkan ulang
HASIL: APK ini SIAP DIBAGIKAN - seluruh kode notifikasi sudah ikut.
```

Lokasi: `android/app/build/outputs/apk/release/E-RT04-v1.0.0-release.apk`

---

## Langkah yang harus Anda lakukan

### 1. Jalankan SQL di Supabase (sekali saja)

Buka **Supabase Dashboard → SQL Editor → New query**, lalu jalankan berurutan:

1. Isi `scripts/aktifkan-rpc-fcm-token.sql` → tekan **Run**
   Semua baris hasil harus `OK`.
2. Isi `scripts/aktifkan-notif-otomatis-ews.sql` → tekan **Run**
   (lewati bila sudah pernah dijalankan)

### 2. Pasang APK baru di HP

APK lama **wajib** dihapus lebih dulu, karena Android tidak menimpa bundle web
milik aplikasi yang sudah terpasang:

1. Di HP: **Uninstall** aplikasi E-RT04 yang lama.
2. Pindahkan `E-RT04-v1.0.0-release.apk` ke HP, lalu pasang.
3. Saat aplikasi pertama kali dibuka, muncul permintaan izin notifikasi →
   pilih **Izinkan**. Ini wajib untuk Android 13 ke atas.

### 3. Pastikan HP sudah terdaftar

Buka aplikasi → menu **EWS Darurat**. Di atas daftar laporan ada panel
**Status Notifikasi HP Ini**. Semua baris harus hijau:

```
Mode aplikasi            : Aplikasi Android (APK)
Izin notifikasi          : Diizinkan
Token dari Firebase      : Diterima
Token tersimpan di server: Ya - HP ini siap menerima
```

Bila ada baris merah, panel langsung menampilkan tindakan yang harus
dilakukan. Tekan **Daftarkan ulang** setelah memperbaikinya.

### 4. Uji kirim laporan darurat

Lakukan dengan **dua HP** (atau satu HP + laptop), karena FCM tidak
mengirim notifikasi ke perangkat yang sedang membuka halaman terkait:

1. HP-A: buka aplikasi, pastikan panel status semua hijau, lalu **tutup
   aplikasi** (tekan Home, jangan swipe-close).
2. HP-B / laptop: kirim satu laporan darurat.
3. HP-A harus menerima notifikasi 🚨 dalam beberapa detik.

### 5. Bila masih belum masuk

Jalankan `scripts/diagnosa-notifikasi-ews.sql` di SQL Editor. Hasilnya berupa
7 baris pemeriksaan; perbaiki baris yang bukan `OK` mulai dari nomor terkecil.

Yang paling menentukan adalah **langkah 1 — HP terdaftar**. Bila masih
`0 device`, berarti APK di HP belum diganti dengan yang baru, atau izin
notifikasi belum diberikan.

---

## Catatan penting

Setiap kali kode di `src/` diubah, APK **tidak** ikut berubah dengan
sendirinya. Alur yang benar:

```
npm run build
npx cap sync android
cd android
.\gradlew assembleRelease
```

Sebelum membagikan APK, pastikan dulu dengan memeriksa isi APK-nya:

```
powershell -ExecutionPolicy Bypass -File scripts\cek-isi-apk-notif.ps1
```

Harus tertulis *"APK ini SIAP DIBAGIKAN"*. Langkah pengecekan inilah yang
terlewat sehingga notifikasi tidak pernah masuk ke HP warga.
