# SIP3 — Checklist Fitur Baru

Progress implementasi fitur baru SIP3. Update setiap task selesai.

## Status

- [x] Task 1 — Pencarian warga di form tambah tagihan satuan
- [x] Task 2 — Metode pembayaran iuran (bisa diedit pengurus)
- [x] Task 3 — Tombol "Masuk" di panel info RT → popup login
- [x] Task 4 — KK opsional di pendaftaran & impor warga
- [x] Task 5 — Popup detail EWS saat notifikasi diklik
- [x] Task 6 — QR code scannable untuk verifikasi surat
- [x] Task 7 — Reminder iuran bulanan (default nonaktif, diatur admin)
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
- [ ] A4 — **182 `<label>` tanpa `htmlFor`** → input tak bernama bagi screen
      reader. Pasangkan `id` + `htmlFor` per berkas. Urutan: `DataWargaView`
      (pola contoh di baris 770-782) → `DataKKView` → `DaftarWargaModal` →
      `IuranAdminView` → sisanya
- [ ] A5 — **305 dari 379 tombol tanpa nama aksesibel.** Tambah `aria-label` ke
      tombol ikon-saja. Sisir bareng A4 agar sekali buka berkas
- [ ] A7 — `loading="lazy"` pada 16 `<img>` (foto bukti EWS/iuran/UMKM).
      Kecualikan logo `BekasiLogo` & `SuratPrintTemplate` (above-the-fold/cetak)

## Fase 2 — Kode mati & duplikasi

- [ ] C1 — Hapus **90 import/variabel tak terpakai** (mayoritas ikon
      `lucide-react`). Terburuk: `TemplateSuratPengantarView` 13,
      `DashboardView` 10, `BansosPrioritasView` 9, `DataKKView` 8.
      `eslint --fix` tidak menghapus import, jadi manual per berkas
- [ ] C2 — 4 fungsi mati — **konfirmasi dulu** apakah fitur belum tersambung
      (kalau iya: sambungkan, bukan hapus): `handleSelectPreset`
      (`SuratPengantarView.tsx:205`), `handleDownloadHtml`
      (`TemplateSuratPengantarView.tsx:387`), `maskPhone`
      (`DataWargaView.tsx:26`), `setTanggalLapor`/`setKeterangan`
      (`MutasiPendudukView.tsx:46`)
- [ ] C3 — Satukan **5 salinan `formatTanggal`** ke `src/utils/tanggal.ts` (baru):
      `formatTanggalPanjang` (dengan hari), `formatTanggalSedang` (tanpa hari),
      re-export `formatTanggalRingkas` dari `utils/keuangan.ts:54`. Ganti di
      `KegiatanAdminView:31`, `PengumumanAdminView:48`, `LacakPengajuanModal:29`,
      `VerifikasiSurat:19`, `WargaLayout:96`
- [ ] C4 — Ganti 9 pemanggilan `toLocaleString('id-ID')`/`Intl.NumberFormat`
      inline dengan `formatRupiah` dari `utils/pesananWa.ts:12`
- [ ] C5 — Ganti **21 pill status hardcode** dengan helper `statusBadge()` di
      `utils/statusBadge.ts` (helper baru dipakai 8 berkas)
- [ ] C6 — Token `brand-500/600/700` di `index.css:20-22` **dipakai 0 kali** vs
      789 `emerald-*` hardcode. **Adopsi, jangan hapus:** ganti di komponen
      shared dulu (`Navbar`, `Sidebar`, `ConfirmDialog`, `LoginPortal`), bukan
      789 sekaligus

## Fase 3 — Performa & ukuran bundle

- [ ] B1 — Lazy-load view admin. Ikuti pola `lazy()` + `<Suspense>` +
      `ViewLoader` yang **sudah ada** di `App.tsx:47-56`. Target:
      `IuranAdminView` (1491 baris), `TemplateSuratPengantarView` (1434),
      `DataWargaView` (1106), `SuratPengantarView` (972), `DataKKView` (787),
      `KegiatanAdminView`, `PengumumanAdminView`, `KeuanganAdminView`,
      `PengaduanAdminView`, `UmkmAdminView`, `EWSAdminView`, `AuditLogView`,
      `BansosPrioritasView`, `MutasiPendudukView`.
      **Biarkan eager:** `DashboardView`, `Navbar`, `Sidebar` (tab awal)
- [ ] B6 — Tambah `motion: ['motion/react']` ke `manualChunks` di
      `vite.config.ts`. Hanya `WargaDashboard` yang pakai, jadi sisi pengurus
      berhenti mengunduh 719 KB itu
- [ ] B2 — **Render ganda daftar** (paling berdampak): tabel desktop
      (`hidden md:block`) DAN kartu mobile (`md:hidden`) dua-duanya di DOM.
      Satukan jadi satu sumber render, atau gate dengan `matchMedia`.
      `DataWargaView.tsx:413`+`:540`, `DataKKView.tsx:321`+`:409`
- [ ] B3 — Paginasi klien (50/halaman) — ikuti batas `.slice(0, 50)` yang sudah
      dipakai di `IuranAdminView.tsx:179` agar konsisten
- [ ] B7/B4 — Hoist `calculateDemographics()` keluar dari `.filter()`
      (`DataWargaView.tsx:140`) ke `useMemo` daftar terperkaya; bungkus komponen
      baris dengan `React.memo` (saat ini 0 penggunaan di seluruh proyek)
- [ ] B5 — *(opsional, ukur dulu)* Pecah `refreshAllData()` (`App.tsx:103-120`)
      yang membaca ulang 7 daftar pada setiap perubahan storage. Kerjakan HANYA
      bila B2–B7 belum cukup — menyentuh alur sinkronisasi realtime, jangan
      digabung perubahan lain

## Fase 4 — Kualitas tipe & higiene

- [ ] D1 — Ganti cast malas `as any` dengan union bernama yang **sudah ada** di
      `types.ts` (`JenisKelamin`, `StatusPerkawinan`, `StatusHubunganKK`,
      `StatusTinggal`, `StatusBansos`): `DataWargaView` 13
      (baris 235-249, 826-969), `ImportWargaModal` 4, `DataKKView` 2,
      `PengajuanWargaAdminView` 2.
      **JANGAN sentuh** 68 `any` di `supabaseService.ts` — keputusan sadar yang
      sudah didokumentasikan di `eslint.config.js`
- [ ] D4 — `package.json`: hapus `vite` dari `dependencies` (sudah ada di
      `devDependencies`); pindahkan `@vitejs/plugin-react` &
      `@tailwindcss/vite` ke `devDependencies`. `npm install` + build ulang —
      pastikan Vercel tetap hijau
- [ ] D3 — Bereskan 51 `console.*`. Sisakan yang memang jalur diagnosa
      (`ErrorBoundary`, kegagalan plugin Capacitor di `main.tsx`); hapus
      `console.log` murni debug
- [ ] D2 — Turunkan 22 warning `set-state-in-effect`. **Jangan kejar semua** —
      ambil yang jelas bisa jadi `useMemo` atau inisialisasi `useState`. Pola
      muat-data-saat-mount itu sah dan sengaja di-`warn` di config
- [ ] D5 — Pasang `vitest` + `@testing-library/react` (belum ada framework test
      sama sekali). Test unit murni yang paling berharga dulu:
      `utils/keuangan.ts` (`hitungRingkasan`, `namaBulan`), `utils/tanggal.ts`,
      `utils/statusBadge.ts`. Tambah skrip `"test": "vitest run"`
- [ ] D6 — Hapus `lint-tmp.json` dari root repo (sisa berkas audit)

## Uji regresi manual

Tidak ada test E2E, jadi wajib setelah Fase 3:

- [ ] Login pengurus → buka tiap tab admin, pastikan tak ada layar kosong dari
      `lazy()` yang salah pasang
- [ ] Login warga → buka tiap tab warga
- [ ] Cetak surat pengantar — pastikan tak ada regresi layout cetak
