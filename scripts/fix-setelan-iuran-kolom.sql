-- =====================================================================
-- Perbaikan: Tambah 3 kolom setelan iuran yang kurang
-- =====================================================================
-- KONTEKS: Task 2 & Task 7 di checklist sudah diimplementasi di frontend
-- (metode pembayaran & reminder iuran bulanan), tapi 3 kolom yang mereka
-- butuhkan tidak pernah dibuat di database. Akibatnya, simpan setelan
-- iuran selalu gagal dengan error "column does not exist".
--
-- Skrip ini idempoten (aman dijalankan berulang). Jalankan di Supabase
-- SQL Editor sebelum menggunakan fitur pengaturan iuran di panel admin.
--
-- PERUBAHAN:
--   - metode_pembayaran: array objek metode bayar (JSONB, default [])
--   - reminder_aktif: toggle reminder bulanan (BOOLEAN, default false)
--   - hari_reminder: tanggal kirim reminder 1-28 (INT, default 1)
-- =====================================================================

ALTER TABLE public.pengaturan_iuran_rt004
  ADD COLUMN IF NOT EXISTS metode_pembayaran JSONB   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reminder_aktif    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hari_reminder     INT     NOT NULL DEFAULT 1
    CHECK (hari_reminder BETWEEN 1 AND 28);

-- Pastikan baris default ada (dibuat oleh fitur-iuran-rt.sql, tapi
-- kita ulangi di sini untuk deployment yang langsung jalankan fix ini)
INSERT INTO public.pengaturan_iuran_rt004 (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Verifikasi: query ini harus mengembalikan 9 kolom (termasuk 3 baru)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pengaturan_iuran_rt004'
ORDER BY ordinal_position;
