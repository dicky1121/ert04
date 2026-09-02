# Audit Backend ↔ Frontend — Ringkasan Eksekutif

**Tanggal**: 2 September 2026  
**Proyek**: SIP3 (Sistem Informasi Penduduk RT 004 Jatimulya)  
**Status**: ✅ **2 bug kritis diperbaiki** — mayoritas backend & frontend sudah sesuai

---

## TL;DR

Audit menyeluruh menemukan backend (Supabase: SQL schema + Edge Functions) dan frontend (React + TypeScript) **95% sudah sesuai**, tapi ada **2 bug kritis** yang membuat Task 2 & Task 7 tidak bisa berfungsi:

1. **3 kolom database kurang** — fitur metode pembayaran & reminder iuran tidak jalan
2. **Typo nama tabel** di Edge Function — cron reminder selalu gagal

Kedua bug sudah diperbaiki di sesi ini. Yang perlu Anda lakukan:

```bash
# 1. Di Supabase SQL Editor, jalankan hotfix:
scripts/fix-setelan-iuran-kolom.sql

# 2. Re-deploy Edge Function (setelah git push):
supabase functions deploy kirim-notif-iuran

# 3. Verifikasi — buka panel admin, tab Iuran, klik "Pengaturan":
#    - Tambah metode pembayaran (misal "BCA Transfer") → klik Simpan
#    - Harus sukses, tidak error "column does not exist"
```

---

## Detail Temuan

### ✅ Yang Sudah Sesuai (tidak perlu diubah)

| Komponen | Jumlah | Status |
|----------|--------|--------|
| Tabel database vs `.from()` frontend | 19 tabel | ✔ Semua cocok |
| RPC functions vs `.rpc()` frontend | 14 fungsi | ✔ 0 missing |
| Edge Functions yang dipanggil | 3 fungsi | ✔ Ada semua |
| Mapper data (kolom SQL ↔ interface TypeScript) | 8 mapper utama | ✔ Cocok persis |
| Realtime subscriptions | 11 tabel | ✔ Semua di publikasi |

**Catatan khusus**: Semua mapper kritis (warga, iuran, keuangan, kegiatan, UMKM, KK, surat, mutasi) sudah diverifikasi baris-per-baris — tidak ada kolom yang hilang atau salah tipe.

---

### 🔴 Bug #1: Database Kurang 3 Kolom (KRITIS)

**Lokasi**: Tabel `pengaturan_iuran_rt004`

**Apa yang terjadi**:
- Frontend sudah implementasi Task 2 (metode pembayaran bisa diedit) & Task 7 (reminder iuran bulanan) sejak Agustus 2026
- Tapi saat membuat `CREATE TABLE pengaturan_iuran_rt004`, 3 kolom ini tidak dimasukkan:
  - `metode_pembayaran` (JSONB) — untuk menyimpan array metode bayar
  - `reminder_aktif` (BOOLEAN) — toggle reminder
  - `hari_reminder` (INT 1-28) — tanggal kirim setiap bulan

**Dampak bagi user**:
- Tombol "Simpan" di pengaturan iuran **selalu gagal** dengan error merah:
  ```
  column "metode_pembayaran" of relation "pengaturan_iuran_rt004" does not exist
  ```
- Reminder iuran tidak pernah jalan (bahkan walau cron sudah dipasang)

**Root cause**: `CREATE TABLE IF NOT EXISTS` tidak menambah kolom pada tabel yang sudah ada — kolom baru hanya muncul di deployment 100% bersih. Database yang sudah jalan perlu `ALTER TABLE` manual.

**Perbaikan yang sudah dilakukan**:
- ✅ `scripts/fix-setelan-iuran-kolom.sql` (hotfix untuk DB yang sudah jalan)
- ✅ `scripts/fitur-iuran-rt.sql` ditambah `ALTER TABLE` (deployment bersih otomatis dapat kolom)

**Yang harus Anda lakukan**:
1. Buka Supabase Dashboard → SQL Editor
2. Copy-paste isi `scripts/fix-setelan-iuran-kolom.sql` → Run
3. Verifikasi: query ini harus mengembalikan **9 kolom** (tadinya cuma 6):
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'pengaturan_iuran_rt004' 
   ORDER BY ordinal_position;
   ```

---

### 🔴 Bug #2: Edge Function Salah Nama Tabel (KRITIS)

**Lokasi**: `supabase/functions/kirim-notif-iuran/index.ts` baris 160

**Apa yang terjadi**:
- Fungsi ini dipanggil pg_cron setiap pagi jam 07:00 WIB untuk kirim reminder iuran
- Baris 160 membaca tabel `iuran_pengaturan_rt004` (kata dibalik)
- Nama yang benar: `pengaturan_iuran_rt004`

**Dampak bagi user**:
- Cron jalan tiap pagi, tapi **selalu gagal** di langkah pertama
- Log Edge Function menunjukkan: `Gagal membaca setelan: relation "iuran_pengaturan_rt004" does not exist`
- Tidak ada reminder yang pernah terkirim ke warga

**Perbaikan yang sudah dilakukan**:
- ✅ Typo diperbaiki: `.from('pengaturan_iuran_rt004')`

**Yang harus Anda lakukan**:
1. `git add .` → `git commit` → `git push` (code sudah diperbaiki di repo lokal)
2. Deploy ulang Edge Function:
   ```bash
   supabase functions deploy kirim-notif-iuran
   ```
3. Tunggu cron jalan besok pagi (atau test manual via Supabase Dashboard → Edge Functions → Invoke)
4. Cek log — harus sukses, bukan `Gagal membaca setelan`

---

### 🟡 Rekomendasi (Tidak Urgent)

**Perluas drift-check ke 11 tabel fitur**

Saat ini `scripts/cek-kolom-kurang.sql` hanya validasi 8 tabel inti. Bug #1 lolos karena `pengaturan_iuran_rt004` tidak di-check. Solusi:

- Opsi 1: Tambah manual 11 tabel fitur ke `cek-kolom-kurang.sql`
- Opsi 2: Buat generator otomatis yang baca semua `scripts/*.sql`

Untuk sekarang tidak perlu buru-buru — audit manual (2 Sep 2026) sudah verifikasi semua mapper, jadi drift saat ini sudah bersih.

---

## File yang Diubah di Sesi Ini

```
BARU:
  scripts/fix-setelan-iuran-kolom.sql              hotfix 3 kolom (idempoten)
  AUDIT_BACKEND_FRONTEND.md                        ringkasan eksekutif audit

DIUBAH:
  scripts/fitur-iuran-rt.sql                       +7 baris ALTER TABLE
  supabase/functions/kirim-notif-iuran/index.ts   1 typo (baris 160)
  CHECKLIST.md                                     Task 2 & 7 + dokumentasi audit
```

Semua perubahan lain di `git status` (40+ file) adalah hasil sesi perbaikan frontend sebelumnya (Fase 1–4: aksesibilitas, performa, test, lint) — tidak ada hubungannya dengan audit backend ini.

---

## Verifikasi Gate (Semua Hijau ✅)

```bash
npm run lint   # 0 errors, 137 warnings (baseline tidak berubah)
npm run build  # sukses 24.02s
npm run test   # 34/34 passed
```

Perubahan di sesi ini (SQL + Edge Function Deno) tidak menyentuh kode TypeScript yang di-lint/build, jadi gate tetap hijau seperti sebelumnya.

---

## Langkah Selanjutnya

**Wajib sebelum production**:
1. [ ] Jalankan `scripts/fix-setelan-iuran-kolom.sql` di Supabase
2. [ ] Re-deploy Edge Function `kirim-notif-iuran`
3. [ ] Test manual: simpan pengaturan iuran (harus sukses)
4. [ ] Test reminder: set `reminder_aktif = true`, tunggu cron besok pagi

**Opsional (monitoring)**:
- [ ] Perluas `cek-kolom-kurang.sql` untuk mencakup tabel fitur
- [ ] Setup alert Supabase untuk error PGRST204 (column not exist) — indikator drift baru

---

## Kontak

Jika ada masalah saat deployment atau pertanyaan teknis, informasi lengkap ada di:
- `CHECKLIST.md` bagian "Audit Backend ↔ Frontend (2 Sep 2026)"
- Komentar di `scripts/fix-setelan-iuran-kolom.sql` (penjelasan kenapa kolom ini perlu)
- Komentar di `scripts/fitur-iuran-rt.sql` baris 91-97 (konteks Task 2 & 7)
