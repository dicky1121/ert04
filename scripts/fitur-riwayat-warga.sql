-- =====================================================================
-- FITUR: RIWAYAT PRIBADI WARGA — "Surat Saya" & "Pengaduan Saya"
--   (bagian dari Portal Warga Terpadu — mendukung kartu statistik Beranda)
--
-- MASALAH YANG DISELESAIKAN:
--   Beranda warga menampilkan 3 angka pribadi (Tagihan / Surat / Pengaduan).
--   Tagihan sudah bisa (iuran_rt004 + RLS my_warga_id), tetapi:
--     - surat_pengantar_rt004 hanya bisa dibaca PENGURUS → warga dapat 0 baris.
--     - pengaduan_rt004 sama sekali tak punya kaitan ke warga (tak ada
--       kolom nik/warga_id), jadi mustahil dihitung per orang.
--
-- PENDEKATAN: ADITIF SAJA.
--   Skrip ini TIDAK mengubah/menghapus satu pun policy RLS yang sudah ada.
--   Warga tetap TIDAK diberi SELECT langsung ke surat_pengantar_rt004 —
--   akses lewat RPC SECURITY DEFINER yang sudah di-scope ke pemanggil.
--   Layar pengurus karena itu nol risiko regresi.
--
-- ISI:
--   1. Kolom baru pengaduan_rt004.warga_id (TEXT, nullable) + index.
--   2. Trigger BEFORE INSERT yang menstempel warga_id dari sesi login.
--      Pakai TRIGGER, bukan mengubah kirim_pengaduan() — supaya kalau
--      setup-sapa-warga.sql suatu saat dijalankan ulang, penstempelan
--      tidak hilang diam-diam.
--   3. RPC public.pengajuan_saya()  → daftar surat milik pemanggil.
--   4. RPC public.pengaduan_saya()  → daftar pengaduan milik pemanggil.
--
-- KEAMANAN:
--   - Kedua RPC hanya untuk `authenticated`; anon DICABUT (data pribadi).
--   - Bila my_warga_id() NULL (belum login / akun belum AKTIF / pengurus),
--     kedua RPC mengembalikan KOSONG — NULL tidak boleh berarti "cocok semua".
--   - Keduanya READ-ONLY (STABLE, hanya SELECT). Tidak ada jalur tulis baru.
--
-- CARA PAKAI: Supabase Dashboard → SQL Editor → tempel semua → Run.
--   Idempoten (aman dijalankan berulang). Blok verifikasi di akhir harus
--   semua "OK".
--
-- PRASYARAT:
--   - scripts/setup-skema-utama.sql (warga_rt004, surat_pengantar_rt004).
--   - scripts/setup-sapa-warga.sql (pengaduan_rt004, kirim_pengaduan).
--   - scripts/fitur-iuran-rt.sql (menyediakan public.my_warga_id()).
-- =====================================================================

-- =====================================================================
-- 0. PENGAMAN PRASYARAT — hentikan lebih awal dengan pesan jelas
-- =====================================================================
DO $$
BEGIN
    IF to_regprocedure('public.my_warga_id()') IS NULL THEN
        RAISE EXCEPTION 'public.my_warga_id() belum ada — jalankan scripts/fitur-iuran-rt.sql lebih dulu.';
    END IF;
    IF to_regclass('public.pengaduan_rt004') IS NULL THEN
        RAISE EXCEPTION 'public.pengaduan_rt004 belum ada — jalankan scripts/setup-sapa-warga.sql lebih dulu.';
    END IF;
    IF to_regclass('public.surat_pengantar_rt004') IS NULL THEN
        RAISE EXCEPTION 'public.surat_pengantar_rt004 belum ada — jalankan scripts/setup-skema-utama.sql lebih dulu.';
    END IF;
END $$;

-- =====================================================================
-- 1. KOLOM warga_id PADA PENGADUAN
--   TEXT (bukan UUID) karena warga_rt004.id bertipe TEXT.
--   NULLABLE + ON DELETE SET NULL: pengaduan lama (dan pengaduan anon,
--   bila kanal publik dibuka lagi) tetap sah tanpa pemilik.
-- =====================================================================
ALTER TABLE public.pengaduan_rt004
    ADD COLUMN IF NOT EXISTS warga_id TEXT NULL
    REFERENCES public.warga_rt004(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pengaduan_rt004.warga_id IS
    'Pemilik laporan bila dikirim oleh warga yang login (distempel trigger). NULL untuk laporan tanpa akun.';

CREATE INDEX IF NOT EXISTS idx_pengaduan_rt004_warga_waktu
    ON public.pengaduan_rt004 (warga_id, created_at DESC);

-- =====================================================================
-- 2. TRIGGER PENSTEMPEL PEMILIK
--   Dijalankan BEFORE INSERT, termasuk saat insert berasal dari
--   kirim_pengaduan() yang SECURITY DEFINER — auth.uid() dibaca dari GUC
--   klaim JWT, jadi tetap terbaca di dalam fungsi definer.
--   Hanya mengisi bila masih NULL → tidak menimpa nilai eksplisit.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.stamp_pengaduan_warga()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.warga_id IS NULL THEN
        NEW.warga_id := public.my_warga_id();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pengaduan_stamp_warga ON public.pengaduan_rt004;
CREATE TRIGGER trg_pengaduan_stamp_warga
    BEFORE INSERT ON public.pengaduan_rt004
    FOR EACH ROW EXECUTE FUNCTION public.stamp_pengaduan_warga();

-- =====================================================================
-- 3. RPC: DAFTAR PENGAJUAN SURAT MILIK PEMANGGIL
--   Dicocokkan lewat NIK warga yang login. Tidak membuka tabel surat ke
--   warga — kolom sensitif (alamat, nomor KK, dsb.) tidak ikut dikembalikan.
-- =====================================================================
DROP FUNCTION IF EXISTS public.pengajuan_saya();
CREATE FUNCTION public.pengajuan_saya()
RETURNS TABLE (
    nomor_surat       TEXT,
    jenis_surat       TEXT,
    judul_surat       TEXT,
    keperluan         TEXT,
    status            TEXT,
    tanggal_pengajuan DATE,
    tanggal_disetujui DATE,
    alasan_penolakan  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_warga_id TEXT := public.my_warga_id();
    v_nik      TEXT;
BEGIN
    -- Bukan warga login (anon / pengurus / akun belum AKTIF) → kosong.
    IF v_warga_id IS NULL THEN
        RETURN;
    END IF;

    SELECT w.nik INTO v_nik FROM public.warga_rt004 w WHERE w.id = v_warga_id;
    IF v_nik IS NULL OR btrim(v_nik) = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT s.nomor_surat::TEXT,
           s.jenis_surat::TEXT,
           s.judul_surat::TEXT,
           s.keperluan::TEXT,
           s.status::TEXT,
           s.tanggal_pengajuan,
           s.tanggal_disetujui,
           s.alasan_penolakan::TEXT
    FROM public.surat_pengantar_rt004 s
    WHERE s.nik_pemohon = v_nik
    ORDER BY s.tanggal_pengajuan DESC NULLS LAST, s.nomor_surat DESC
    LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.pengajuan_saya() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pengajuan_saya() TO authenticated;

COMMENT ON FUNCTION public.pengajuan_saya() IS
    'Riwayat pengajuan surat milik warga yang sedang login (maks 50 terbaru). Kosong bila bukan warga aktif.';

-- =====================================================================
-- 4. RPC: DAFTAR PENGADUAN MILIK PEMANGGIL
--   nama/kontak pelapor sengaja tidak dikembalikan — pemanggil sudah
--   tahu datanya sendiri, tak perlu ikut lalu-lalang di jaringan.
-- =====================================================================
DROP FUNCTION IF EXISTS public.pengaduan_saya();
CREATE FUNCTION public.pengaduan_saya()
RETURNS TABLE (
    nomor_tiket     TEXT,
    kategori        TEXT,
    alamat_kejadian TEXT,
    isi_laporan     TEXT,
    status          TEXT,
    tanggapan       TEXT,
    created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_warga_id TEXT := public.my_warga_id();
BEGIN
    IF v_warga_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT p.nomor_tiket::TEXT,
           p.kategori::TEXT,
           p.alamat_kejadian::TEXT,
           p.isi_laporan::TEXT,
           p.status::TEXT,
           p.tanggapan::TEXT,
           p.created_at
    FROM public.pengaduan_rt004 p
    WHERE p.warga_id = v_warga_id
    ORDER BY p.created_at DESC
    LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.pengaduan_saya() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pengaduan_saya() TO authenticated;

COMMENT ON FUNCTION public.pengaduan_saya() IS
    'Riwayat pengaduan milik warga yang sedang login (maks 50 terbaru). Kosong bila bukan warga aktif.';

-- =====================================================================
-- VERIFIKASI (semua baris harus "OK")
-- =====================================================================
SELECT 'Kolom pengaduan_rt004.warga_id' AS pemeriksaan,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='pengaduan_rt004' AND column_name='warga_id'
    ) THEN 'OK - ada' ELSE 'GAGAL - kolom belum terbentuk' END AS status
UNION ALL
SELECT 'Tipe kolom warga_id (harus text)',
    CASE WHEN (
        SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='pengaduan_rt004' AND column_name='warga_id'
    ) = 'text' THEN 'OK - text' ELSE 'PERIKSA - tipe tak sesuai warga_rt004.id' END
UNION ALL
SELECT 'Index idx_pengaduan_rt004_warga_waktu',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname='public'
        AND indexname='idx_pengaduan_rt004_warga_waktu'
    ) THEN 'OK - ada' ELSE 'GAGAL' END
UNION ALL
SELECT 'Trigger trg_pengaduan_stamp_warga',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_pengaduan_stamp_warga')
         THEN 'OK - aktif' ELSE 'GAGAL' END
UNION ALL
SELECT 'RPC pengajuan_saya()',
    CASE WHEN to_regprocedure('public.pengajuan_saya()') IS NOT NULL
         THEN 'OK - ada' ELSE 'GAGAL' END
UNION ALL
SELECT 'RPC pengaduan_saya()',
    CASE WHEN to_regprocedure('public.pengaduan_saya()') IS NOT NULL
         THEN 'OK - ada' ELSE 'GAGAL' END
UNION ALL
SELECT 'anon TIDAK bisa jalankan pengajuan_saya',
    CASE WHEN NOT has_function_privilege('anon', 'public.pengajuan_saya()', 'EXECUTE')
         THEN 'OK - anon diblokir' ELSE 'BAHAYA - anon bisa jalankan' END
UNION ALL
SELECT 'anon TIDAK bisa jalankan pengaduan_saya',
    CASE WHEN NOT has_function_privilege('anon', 'public.pengaduan_saya()', 'EXECUTE')
         THEN 'OK - anon diblokir' ELSE 'BAHAYA - anon bisa jalankan' END
UNION ALL
SELECT 'authenticated bisa jalankan kedua RPC',
    CASE WHEN has_function_privilege('authenticated', 'public.pengajuan_saya()', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.pengaduan_saya()', 'EXECUTE')
         THEN 'OK - diizinkan' ELSE 'GAGAL - grant hilang' END
UNION ALL
SELECT 'anon TETAP tanpa akses tabel pengaduan',
    CASE WHEN NOT has_table_privilege('anon', 'public.pengaduan_rt004', 'SELECT')
         THEN 'OK - anon diblokir' ELSE 'BAHAYA - anon bisa baca' END
UNION ALL
SELECT 'Policy surat_pengantar_rt004 tidak berubah',
    CASE WHEN (SELECT count(*) FROM pg_policies
               WHERE schemaname='public' AND tablename='surat_pengantar_rt004') >= 1
         THEN 'OK - policy pengurus utuh' ELSE 'PERIKSA - policy surat hilang' END;

-- Muat ulang schema cache PostgREST agar RPC baru langsung dikenali API
NOTIFY pgrst, 'reload schema';
