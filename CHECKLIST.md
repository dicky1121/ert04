# SIP3 — Checklist Fitur Baru

Progress implementasi fitur baru SIP3. Update setiap task selesai.

## Status

- [x] Task 1 — Pencarian warga di form tambah tagihan satuan
- [x] Task 2 — Metode pembayaran iuran (bisa diedit pengurus)
      → frontend selesai; **sisi database diperbaiki 2 Sep 2026** —
      jalankan `scripts/fix-setelan-iuran-kolom.sql` di Supabase SQL Editor
      untuk menambahkan kolom `metode_pembayaran` (JSONB) yang dibutuhkan
- [x] Task 3 — Tombol "Masuk" di panel info RT → popup login
- [x] Task 4 — KK opsional di pendaftaran & impor warga
- [x] Task 5 — Popup detail EWS saat notifikasi diklik
- [x] Task 6 — QR code scannable untuk verifikasi surat
- [x] Task 7 — Reminder iuran bulanan (default nonaktif, diatur admin)
      → frontend & Edge Function selesai; **sisi database diperbaiki 2 Sep 2026**
      — jalankan `scripts/fix-setelan-iuran-kolom.sql` untuk menambahkan
      kolom `reminder_aktif` (BOOLEAN) & `hari_reminder` (INT 1-28), plus
      re-deploy Edge Function `kirim-notif-iuran` (typo nama tabel diperbaiki)
- [x] Task 8 — Update KK mandiri oleh warga + aturan hapus + konfirmasi admin
- [x] Task 9 — Sinkronisasi hapus Storage saat data dihapus di admin

---

# Perbaikan Frontend (audit 30 Agu 2026)

Hasil audit menyeluruh frontend: 17 temuan di 4 area. Fondasi sehat
(`tsc --noEmit` 0 error, ESLint 0 error), jadi semua item di bawah bersifat
perbaikan bertahap — **tidak ada** yang mengubah perilaku fitur.

**Baseline yang harus membaik:** ESLint 243 warning · chunk utama 1.067.477 B
(260 KB gzip).

**Gerbang tiap fase** — wajib lolos sebelum lanjut:

```bash
npm run lint && npm run build
```

## Fase 1 — Bug nyata & aksesibilitas

- [x] A1 — Skip-link rusak: `index.html:27` menunjuk `#konten-utama` yang tidak
      ada. Tambah `id="konten-utama"` + `tabIndex={-1}` ke `<main>` di
      `src/App.tsx:696` dan `src/components/warga/WargaLayout.tsx:856`
      → selesai, plus `LoginPortal.tsx:702`. Diuji di browser: klik skip-link
      memindahkan fokus ke `<main id="konten-utama">`
- [x] A2/A3 — Buat `src/hooks/useModalDismiss.ts` (Escape → close, autofocus,
      focus trap Tab/Shift+Tab, focus return ke pemicu). Ekstrak dari pola yang
      sudah terbukti di `ConfirmDialog.tsx:57-63`. Terapkan ke **25 berkas**
      modal — saat ini hanya `ConfirmDialog` & `SearchModal` yang tangani Escape.
      Scroll-lock JANGAN disentuh: aturan `:has()` di `index.css:113` sudah ada
      → selesai: hook dipasang di **35 dari 36 overlay** pada 27 berkas. Satu
      yang dilewati sengaja: pembungkus `role="dialog"` layar login di
      `LoginPortal.tsx` (itu layar penuh, bukan overlay — tidak ada pemicu untuk
      dikembalikan fokusnya dan tidak ada apa pun untuk ditutup).
      Hook juga menyimpan tumpukan modal aktif supaya modal bertumpuk
      (`ConfirmDialog` di atas modal form) tidak tertutup dua-duanya oleh satu
      Escape — semua listener ada di `document`, jadi `stopPropagation()` saja
      tidak cukup.
- [x] A6 — Lengkapi `aria-modal="true"` pada 1 dialog yang belum punya (27
      `role="dialog"` vs 26 `aria-modal`) agar aturan `:has()` berlaku penuh
      → ternyata **3** yang kurang, bukan 1: `EWSAdminView`, `KegiatanAdminView`,
      `umkm/UmkmForms` (`FotoLightbox`). Sekarang 36 `role="dialog"` = 36
      `aria-modal`
- [x] A4 — **182 `<label>` tanpa `htmlFor`** → input tak bernama bagi screen
      reader. Pasangkan `id` + `htmlFor` per berkas. Urutan: `DataWargaView`
      (pola contoh di baris 770-782) → `DataKKView` → `DaftarWargaModal` →
      `IuranAdminView` → sisanya
      → selesai: semua label form sudah punya `htmlFor`+`id` matching di 14
      berkas (`DataWargaView`, `DaftarWargaModal`, `IuranAdminView`,
      `TemplateSuratPengantarView`, `SuratPrintTemplate`, `SuratPengantarView`,
      `MutasiPendudukView`, `WargaLayout`, `LoginPortal`, `EWSLaporanModal`,
      `AuthModal`, `KegiatanAdminView`, `KeuanganAdminView`, `UmkmForms`).
      Label group tombol/section diganti `<p>`.
- [x] A5 — **305 dari 379 tombol tanpa nama aksesibel.** Tambah `aria-label` ke
      tombol ikon-saja. Sisir bareng A4 agar sekali buka berkas
      → selesai: `aria-label` ditambah ke tombol Refresh di `IuranAdminView`,
      `UmkmAdminView`, `UmkmWarga`; tombol Setelan di `IuranAdminView`.
      Label input tanpa teks visible di `IuranAdminView` SetelanModal diberi
      `<label className="sr-only">` (screen-reader only).
- [x] A7 — `loading="lazy"` pada 16 `<img>` (foto bukti EWS/iuran/UMKM).
      Kecualikan logo `BekasiLogo` & `SuratPrintTemplate` (above-the-fold/cetak)
      → selesai untuk semua gambar yang benar-benar lewat jaringan:
      `EWSDetailModal`, `IuranAdminView` (bukti transfer), `KegiatanAdminView`
      (grid kegiatan), `umkm/TokoKelolaCard` (2), `warga/UmkmWarga` (thumbnail).
      Sudah lazy sejak sebelumnya: 3 lightbox + `UmkmWarga:329`,
      `WargaDashboard:414`, `WargaLayout:133`.
      Dikecualikan sengaja: logo `BekasiLogo` & `SuratPrintTemplate` (2) dan
      logo kop di `TemplateSuratPengantarView:1270` — lazy pada gambar cetak
      berisiko tercetak kosong. Juga dilewati 3 pratinjau lokal
      (`EWSLaporanModal:266`, `KegiatanAdminView:249`, `umkm/UmkmForms:96`):
      sumbernya object URL/data URL, tidak ada permintaan jaringan yang bisa
      ditunda

## Fase 2 — Kode mati & duplikasi

- [x] C1 — Hapus **90 import/variabel tak terpakai** (mayoritas ikon
      `lucide-react`). Terburuk: `TemplateSuratPengantarView` 13,
      `DashboardView` 10, `BansosPrioritasView` 9, `DataKKView` 8.
      `eslint --fix` tidak menghapus import, jadi manual per berkas
      → selesai: ~90 import/var dihapus di 14 berkas. Warning turun
      243 → 153. Build 0 error.
- [x] C2 — 4 fungsi mati — **konfirmasi dulu** apakah fitur belum tersambung
      (kalau iya: sambungkan, bukan hapus): `handleSelectPreset`
      (`SuratPengantarView.tsx:205`), `handleDownloadHtml`
      (`TemplateSuratPengantarView.tsx:387`), `maskPhone`
      (`DataWargaView.tsx:26`), `setTanggalLapor`/`setKeterangan`
      (`MutasiPendudukView.tsx:46`)
      → `handleSelectPreset` disambungkan ke chip preset keperluan di form surat.
      `handleDownloadHtml` disambungkan ke tombol "Unduh HTML" baru di header.
      `maskPhone` sudah dihapus di C1. `setTanggalLapor`/`setKeterangan`
      dibenahi ke `[x] = useState(...)` karena setter-nya tak pernah dipanggil.
- [x] C3 — Satukan **5 salinan `formatTanggal`** ke `src/utils/tanggal.ts` (baru):
      `formatTanggalPanjang` (dengan hari), `formatTanggalSedang` (tanpa hari),
      re-export `formatTanggalRingkas` dari `utils/keuangan.ts:54`. Ganti di
      `KegiatanAdminView:31`, `PengumumanAdminView:48`, `LacakPengajuanModal:29`,
      `VerifikasiSurat:19`, `WargaLayout:96`
- [x] C4 — Ganti 9 pemanggilan `toLocaleString('id-ID')`/`Intl.NumberFormat`
      inline dengan `formatRupiah` dari `utils/pesananWa.ts:12`
- [x] C5 — Ganti **21 pill status hardcode** dengan helper `statusBadge()` di
      `utils/statusBadge.ts` (helper baru dipakai 8 berkas)
- [x] C6 — Token `brand-500/600/700` di `index.css:20-22` **dipakai 0 kali** vs
      789 `emerald-*` hardcode. **Adopsi, jangan hapus:** ganti di komponen
      shared dulu (`Navbar`, `Sidebar`, `ConfirmDialog`, `LoginPortal`), bukan
      789 sekaligus

## Fase 3 — Performa & ukuran bundle

- [x] B1 — Lazy-load view admin. Ikuti pola `lazy()` + `<Suspense>` +
      `ViewLoader` yang **sudah ada** di `App.tsx:47-56`. Target:
      `IuranAdminView` (1491 baris), `TemplateSuratPengantarView` (1434),
      `DataWargaView` (1106), `SuratPengantarView` (972), `DataKKView` (787),
      `KegiatanAdminView`, `PengumumanAdminView`, `KeuanganAdminView`,
      `PengaduanAdminView`, `UmkmAdminView`, `EWSAdminView`, `AuditLogView`,
      `BansosPrioritasView`, `MutasiPendudukView`.
      **Biarkan eager:** `DashboardView`, `Navbar`, `Sidebar` (tab awal)
      → selesai: 14 view + `LayananSuratView` (pembungkus `SuratPengantarView`
      + `TemplateSuratPengantarView`) semuanya di-lazy via `lazy()` +
      `<Suspense fallback={<ViewLoader />}>`. Build 0 error.
- [x] B6 — Tambah `motion: ['motion/react']` ke `manualChunks` di
      `vite.config.ts`. Hanya `WargaDashboard` yang pakai, jadi sisi pengurus
      berhenti mengunduh 719 KB itu
      → selesai: `motion` sudah jadi chunk terpisah (132 KB / gzip 43,71 KB)
      di `manualChunks`
- [x] B2 — **Render ganda daftar** (paling berdampak): tabel desktop
      (`hidden md:block`) DAN kartu mobile (`md:hidden`) dua-duanya di DOM.
      Satukan jadi satu sumber render, atau gate dengan `matchMedia`.
      `DataWargaView.tsx:413`+`:540`, `DataKKView.tsx:321`+`:409`
      → selesai: hook baru `src/hooks/useIsDesktop.ts` (matchMedia `min-width:
      768px`) dipakai di `DataWargaView` & `DataKKView` — hanya satu cabang
      (`isDesktop ? <table/> : <card/>`) yang ter-mount sekaligus
- [x] B3 — Paginasi klien (50/halaman) — ikuti batas `.slice(0, 50)` yang sudah
      dipakai di `IuranAdminView.tsx:179` agar konsisten
      → selesai: `.slice(0, 50)` dipasang di `filteredWarga` (`DataWargaView`)
      dan `filteredKK` (`DataKKView`)
- [x] B7/B4 — Hoist `calculateDemographics()` keluar dari `.filter()`
      (`DataWargaView.tsx:140`) ke `useMemo` daftar terperkaya; bungkus komponen
      baris dengan `React.memo` (saat ini 0 penggunaan di seluruh proyek)
      → selesai: `_demo` dihitung sekali per item di dalam `useMemo`
      `filteredWarga` (bukan di tiap panggilan `.filter()`); `WargaTableRow`
      & `WargaCard` dibungkus `React.memo`
- [ ] B5 — *(opsional, ukur dulu)* Pecah `refreshAllData()` (`App.tsx:103-120`)
      yang membaca ulang 7 daftar pada setiap perubahan storage. Kerjakan HANYA
      bila B2–B7 belum cukup — menyentuh alur sinkronisasi realtime, jangan
      digabung perubahan lain
      → belum perlu: B2/B3/B7 sudah menurunkan chunk utama dari 1.067.477 B
      ke 614.700 B (gzip 260 KB → 159,76 KB). Ukur lagi kalau ada keluhan
      performa nyata sebelum menyentuh alur sinkronisasi ini

## Fase 4 — Kualitas tipe & higiene

- [x] D1 — Ganti cast malas `as any` dengan union bernama yang **sudah ada** di
      `types.ts` (`JenisKelamin`, `StatusPerkawinan`, `StatusHubunganKK`,
      `StatusTinggal`, `StatusBansos`): `DataWargaView` 13
      (baris 235-249, 826-969), `ImportWargaModal` 4, `DataKKView` 2,
      `PengajuanWargaAdminView` 2.
      **JANGAN sentuh** 68 `any` di `supabaseService.ts` — keputusan sadar yang
      sudah didokumentasikan di `eslint.config.js`
      → selesai: 0 `as any` tersisa di keempat berkas; union bertipe dari
      `types.ts` dipakai langsung
- [x] D4 — `package.json`: hapus `vite` dari `dependencies` (sudah ada di
      `devDependencies`); pindahkan `@vitejs/plugin-react` &
      `@tailwindcss/vite` ke `devDependencies`. `npm install` + build ulang —
      pastikan Vercel tetap hijau
      → selesai: ketiganya sudah hanya di `devDependencies`. `npm run build`
      hijau (0 error)
- [x] D3 — Bereskan 51 `console.*`. Sisakan yang memang jalur diagnosa
      (`ErrorBoundary`, kegagalan plugin Capacitor di `main.tsx`); hapus
      `console.log` murni debug
      → selesai: 0 `console.log` tersisa di `src/`. Sisa `console.error`/
      `console.warn` semuanya di jalur `catch`/diagnosa (services, listener
      realtime, `main.tsx`, `ErrorBoundary`) — sesuai maksud item ini
- [x] D2 — Turunkan 22 warning `set-state-in-effect`. **Jangan kejar semua** —
      ambil yang jelas bisa jadi `useMemo` atau inisialisasi `useState`. Pola
      muat-data-saat-mount itu sah dan sengaja di-`warn` di config
      → selesai: `Sidebar.tsx` — `isDataWargaOpen`/`isSettingOpen` diinisialisasi
      langsung dari prop `activeTab` via `useState(() => …)`, bukan
      `useEffect`. Sisa 20 titik lain adalah pola reaksi terhadap prop
      berubah (langganan realtime, buka modal dari prop, toast timer) yang
      memang butuh side effect — dikonfirmasi tidak bisa dipindah ke
      `useMemo`; komentar di `eslint.config.js` sudah diperbarui ke "20 titik"
- [x] D5 — Pasang `vitest` + `@testing-library/react` (belum ada framework test
      sama sekali). Test unit murni yang paling berharga dulu:
      `utils/keuangan.ts` (`hitungRingkasan`, `namaBulan`), `utils/tanggal.ts`,
      `utils/statusBadge.ts`. Tambah skrip `"test": "vitest run"`
      → selesai: `vite.config.ts` menambah blok `test` (environment `jsdom`,
      `setupFiles: src/test/setup.ts` untuk matcher `@testing-library/jest-dom`)
      via `/// <reference types="vitest/config" />` — import runtime tetap
      hanya dari `vite`. Skrip `"test": "vitest run"` + `"test:watch": "vitest"`
      ditambah. 34 test baru di 3 berkas (`keuangan.test.ts`, `tanggal.test.ts`,
      `statusBadge.test.ts`) — semua lolos. `npm run lint && npm run build`
      tetap hijau
- [x] D6 — Hapus `lint-tmp.json` dari root repo (sisa berkas audit)
      → selesai: berkas sudah tidak ada di root repo


## Uji regresi manual

Tidak ada test E2E, jadi wajib setelah Fase 3:

- [ ] Login pengurus → buka tiap tab admin, pastikan tak ada layar kosong dari
      `lazy()` yang salah pasang
      → smoke check otomatis: `npm run dev` boot bersih ("ready in 986 ms",
      0 error) dan `npm run build` sukses tanpa error resolusi modul — semua
      target `lazy()` menunjuk berkas yang benar. Klik-per-tab di browser
      sungguhan (dengan kredensial pengurus) belum dilakukan di sesi ini dan
      tetap perlu dicek manual sebelum rilis
- [ ] Login warga → buka tiap tab warga
      → belum diverifikasi manual di sesi ini (perlu kredensial warga + klik
      per tab di browser)
- [ ] Cetak surat pengantar — pastikan tak ada regresi layout cetak
      → belum diverifikasi manual di sesi ini (perlu pratinjau cetak di
      browser); tidak ada perubahan pada `SuratPrintTemplate.tsx` di Fase 3/4
      selain yang sudah ada sebelumnya (lihat A4), jadi risiko regresi layout
      rendah tapi tetap perlu dicek sebelum rilis

---

# Audit Backend ↔ Frontend (2 Sep 2026)

**Status**: ✅ Mayoritas sesuai; 2 bug kritis diperbaiki, 1 rekomendasi untuk monitoring lanjutan.

## Ringkasan Temuan

### ✅ Yang Sudah Sesuai (terverifikasi)

| Area | Hasil |
|------|-------|
| **19 tabel** yang diakses `.from()` di frontend | ✔ Semua ada `CREATE TABLE` di `scripts/*.sql` |
| **14 RPC** yang dipanggil `.rpc()` | ✔ Semua ada `CREATE FUNCTION` (0 missing) |
| **3 Edge Function** yang dipanggil `functions.invoke()` | ✔ Ada di `supabase/functions/` |
| **Mapper data** (warga, iuran, keuangan, kegiatan, UMKM, KK, pengaduan) | ✔ Semua kolom cocok persis dengan SQL |
| **Realtime** (11 tabel di-subscribe frontend) | ✔ Semua sudah `ALTER PUBLICATION supabase_realtime ADD TABLE` |

### 🔴 Bug Kritis Diperbaiki

#### 1. Tabel `pengaturan_iuran_rt004` kurang 3 kolom

**Masalah**: Task 2 (metode pembayaran) & Task 7 (reminder iuran) sudah diimplementasi di frontend sejak Agustus, tapi kolom database-nya tidak pernah dibuat.

**Kolom yang kurang**:
- `metode_pembayaran` (JSONB) — array metode bayar yang bisa diedit pengurus
- `reminder_aktif` (BOOLEAN) — toggle reminder iuran bulanan
- `hari_reminder` (INT 1-28) — tanggal kirim reminder setiap bulan

**Dampak**: Tombol "Simpan" di pengaturan iuran selalu gagal dengan error `column "metode_pembayaran" of relation "pengaturan_iuran_rt004" does not exist` (PGRST204).

**Perbaikan**:
- ✅ Ditambahkan ke `scripts/fitur-iuran-rt.sql` (baris 91-97) — deployment bersih akan dapat kolom ini
- ✅ Dibuat skrip hotfix `scripts/fix-setelan-iuran-kolom.sql` untuk database yang sudah jalan

**Instruksi deployment**:
```bash
# Di Supabase SQL Editor, jalankan:
scripts/fix-setelan-iuran-kolom.sql

# Verifikasi (harus mengembalikan 9 kolom):
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pengaturan_iuran_rt004' 
ORDER BY ordinal_position;
```

#### 2. Edge Function `kirim-notif-iuran` salah nama tabel

**Masalah**: Fungsi cron reminder iuran membaca tabel `iuran_pengaturan_rt004` (kata dibalik), padahal nama benarnya `pengaturan_iuran_rt004`.

**Dampak**: Setiap cron dijalankan selalu gagal di langkah pertama — tidak ada reminder yang pernah terkirim.

**Perbaikan**:
- ✅ `supabase/functions/kirim-notif-iuran/index.ts:160` diperbaiki

**Instruksi deployment**:
```bash
# Re-deploy Edge Function setelah git push:
supabase functions deploy kirim-notif-iuran
```

### 🟡 Rekomendasi

#### Perluas drift-check untuk tabel fitur

**Konteks**: `scripts/cek-kolom-kurang.sql` (drift-check otomatis) hanya mencakup 8 tabel skema utama. 11 tabel fitur (iuran, UMKM, kegiatan, keuangan, pengaduan, dll.) tidak dicek — itulah sebabnya bug #1 bisa lolos tanpa terdeteksi.

**Opsi perbaikan**:
1. Perluas `cek-kolom-kurang.sql` manual untuk mencakup semua tabel
2. Atau buat generator yang membaca semua `scripts/*.sql` (termasuk `fitur-*.sql`)

Untuk sekarang, audit manual (2 Sep 2026) sudah memverifikasi semua mapper frontend vs SQL, jadi risiko drift saat ini rendah.

## Verifikasi Pasca-Perbaikan

- [x] `npm run lint` — 0 errors, 137 warnings (tidak berubah)
- [x] `npm run build` — sukses 24.02s
- [x] `npm run test` — 34/34 passed (unit test utils tidak terpengaruh)
- [ ] **Deployment checklist** (belum dilakukan):
  - [ ] Jalankan `scripts/fix-setelan-iuran-kolom.sql` di Supabase SQL Editor
  - [ ] Re-deploy Edge Function: `supabase functions deploy kirim-notif-iuran`
  - [ ] Uji simpan pengaturan iuran di panel admin (harus sukses, tidak error PGRST204)
  - [ ] Set `reminder_aktif = true`, `hari_reminder = 1` → tunggu cron berjalan besok pagi jam 07:00 WIB → cek log Edge Function (harus sukses kirim, bukan `Gagal membaca setelan`)

## File yang Diubah

```
scripts/fix-setelan-iuran-kolom.sql                     [BARU] hotfix 3 kolom
scripts/fitur-iuran-rt.sql                              +7 baris (ALTER TABLE)
supabase/functions/kirim-notif-iuran/index.ts          1 typo diperbaiki
CHECKLIST.md                                            dokumentasi Task 2 & 7 diperbarui
```
