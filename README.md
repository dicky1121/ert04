# SIP RT 004 RW 007 — Kelurahan Jatimulya

Aplikasi administrasi kependudukan RT: data warga, Kartu Keluarga, surat pengantar
ber-QR, mutasi penduduk, bansos prioritas, audit log, serta sinkronisasi Supabase.

Stack: React 19 + TypeScript + Vite 6 + Tailwind, Supabase (Postgres + Auth).

## Menjalankan secara lokal

Prasyarat: Node.js 18+.

```bash
npm install
cp .env.example .env   # lalu isi kredensial Supabase
npm run dev
```

Perintah lain:

```bash
npm run build      # build produksi ke dist/
npm run preview    # pratinjau hasil build
npx tsc --noEmit   # type check
```

## Konfigurasi Supabase

Isi variabel berikut di `.env` (lokal) atau Environment Variables di Vercel:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon/public key>
```

Gunakan **hanya anon/public key**. Jangan pernah memasukkan `service_role` key
karena semua nilai `VITE_*` ikut ter-bundle ke JavaScript yang bisa dibaca
pengunjung.

### Menyiapkan database & keamanan

1. Buka **SQL Editor** di dashboard Supabase.
2. Jalankan skrip skema yang tersedia di aplikasi: tab **Integrasi → Skema SQL**
   (tombol salin skrip). Skrip tersebut membuat tabel data dan
   `pengurus_profil`, mengaktifkan Row Level Security (RLS), mencabut akses
   `anon`, serta mengaktifkan publication realtime untuk empat tabel utama.
3. Jalankan [`scripts/setup-realtime-sync.sql`](scripts/setup-realtime-sync.sql)
   di SQL Editor. Migration idempotent ini menambahkan metadata perubahan,
   `REPLICA IDENTITY FULL`, trigger pencatat pengguna, dan keempat tabel ke
   publication `supabase_realtime`.
4. Buat akun pengurus di **Authentication → Users → Add user** (email + password).
5. Tambahkan baris profil untuk akun tersebut agar rolenya dikenali aplikasi:

```sql
insert into public.pengurus_profil (id, username, nama_lengkap, role, role_label, is_active)
values (
  '<user-uuid-dari-authentication>',
  'ketua_rt004',
  'Yanto',
  'ADMIN_KETUA_RT',
  'Ketua RT 004 (Admin Utama)',
  true
);
```

Role yang didukung: `ADMIN_KETUA_RT`, `ADMIN_SEKRETARIS`, `BENDAHARA`,
`SEKSI_KEAMANAN`, `STAF_PELAYANAN`.

### Mengaktifkan pengajuan surat publik

Form **Ajukan Surat Pengantar** pada halaman Sapa Warga menggunakan fungsi RPC
terbatas. Agar pengajuan masuk ke daftar Surat Pengantar pengurus, jalankan
[`scripts/setup-public-submission.sql`](scripts/setup-public-submission.sql)
melalui **Supabase Dashboard → SQL Editor**.

RPC tersebut hanya mengizinkan warga menambahkan satu pengajuan tervalidasi.
Pengguna anonim tetap tidak mempunyai akses baca, ubah, atau hapus terhadap
tabel surat maupun data warga.

## Cara login

- **Mode cloud (kredensial Supabase terisi):** login wajib memakai email +
  password akun Supabase Auth. Password diverifikasi di server, dan peran
  diambil otomatis dari `pengurus_profil` — tidak dipilih manual di browser.
  Tersedia juga tautan "Lupa password?" yang mengirim email reset.
- **Mode offline/demo (tanpa kredensial Supabase):** tidak ada PIN bawaan.
  Untuk pengujian lokal, isi `VITE_OFFLINE_DEMO_PIN` di `.env`; jangan pernah
  mengaturnya di Vercel/produksi karena seluruh variabel `VITE_*` terlihat di
  bundle browser. Data mode ini hanya tersimpan di `localStorage` dan tidak
  boleh berisi data warga sebenarnya.

Sinkronisasi data cloud hanya berjalan setelah sesi Supabase terverifikasi
(dipicu dari `App.tsx`), sesuai policy RLS yang menolak permintaan anonim.
Setelah login, aplikasi menarik snapshot terbaru lalu berlangganan perubahan
Postgres pada tabel warga, KK, surat, dan mutasi. Pada mode cloud, setiap operasi
tulis harus berhasil di Supabase terlebih dahulu; `localStorage` diperbarui
setelahnya sebagai cache perangkat.

### Batasan sinkronisasi

- Sinkronisasi saat ini memakai pola last-write-wins per baris melalui `upsert`;
  belum ada UI resolusi konflik untuk dua pengguna yang mengubah baris sama pada
  saat bersamaan.
- Saat perangkat offline, operasi tambah, ubah, hapus, dan impor ditolak agar UI
  tidak menampilkan data yang belum tersimpan di cloud. Data cache terakhir
  tetap dapat dibaca, lalu snapshot terbaru ditarik otomatis ketika koneksi pulih.
- Operasi hapus mengikuti policy RLS: hanya role admin penuh yang dapat
  menghapus data cloud.

## Deploy ke Vercel

1. Import repository ini di Vercel (framework terdeteksi otomatis sebagai Vite).
2. Tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada
   Project Settings → Environment Variables (Production & Preview).
3. Deploy. Konfigurasi rewrite SPA sudah disiapkan di `vercel.json`.
4. Di Supabase, tambahkan domain hasil deploy ke **Authentication → URL
   Configuration** (Site URL & Redirect URLs) agar reset password berfungsi.

## Struktur singkat

```
src/
  App.tsx              # state global, gating login, routing tab
  components/          # tampilan per modul (warga, KK, surat, dsb.)
  services/
    authService.ts     # Supabase Auth: sign in/out, restore session, profil
    authState.ts       # penyimpanan sesi & profil pengurus di memori
    supabaseService.ts # klien Supabase, skema SQL, push/pull data
    storage.ts         # penyimpanan lokal, audit log, ekspor/impor Excel
  data/initialData.ts  # konfigurasi awal; daftar data warga dimulai kosong
```

## Checklist keamanan sebelum push/deploy

- Pastikan `.env`, backup JSON, spreadsheet warga, hasil ekspor, dan dokumen
  identitas tidak ikut ter-commit (`git status --short`).
- Gunakan hanya Supabase **anon/public key** di frontend; jangan pernah menaruh
  `service_role`, JWT secret, password, atau private key di source maupun SQL.
- Jangan menaruh NIK, nomor KK, nomor HP, tanggal lahir, alamat rinci, atau nama
  warga nyata sebagai fixture, placeholder, screenshot, maupun template unduhan.
- Jalankan `npm run lint` dan `npm run build`, lalu tinjau `git diff --check` dan
  `git diff` sebelum push.
- Jika secret pernah ter-commit, menghapusnya dari commit terbaru tidak cukup:
  rotasi secret tersebut dan bersihkan riwayat Git sebelum repository dibuka.
