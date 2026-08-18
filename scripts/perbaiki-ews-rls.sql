-- =====================================================================
-- PATCH: PERBAIKAN FITUR EWS (Early Warning System)
-- Jalankan SEKALI di Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- Aman dijalankan berulang kali (idempotent).
--
-- Yang diperbaiki:
--   1. Policy Storage bucket 'ews-foto' — belum dibuat oleh
--      setup-skema-utama.sql, sehingga upload foto oleh warga (anon) gagal.
--   2. Menghapus baris uji diagnostik yang dipakai saat menelusuri error RLS.
--   3. Menampilkan ringkasan hasil verifikasi di akhir.
--
-- CATATAN penyebab error "new row violates row-level security policy":
--   Policy INSERT tabel ews_laporan_rt004 sudah BENAR. Errornya muncul karena
--   aplikasi memakai INSERT ... RETURNING (`.select()` setelah `.insert()`),
--   dan RETURNING membuat PostgreSQL ikut memeriksa policy SELECT. Policy
--   SELECT tabel ini sengaja dibatasi untuk pengurus aktif saja agar nama dan
--   alamat pelapor tidak bisa dibaca publik. Perbaikannya dilakukan di sisi
--   aplikasi (RETURNING dihapus), BUKAN dengan membuka SELECT untuk anon.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Pastikan bucket 'ews-foto' ada (maks 2 MB, hanya gambar)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ews-foto', 'ews-foto', true, 2097152, ARRAY['image/jpeg','image/jpg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------
-- 2. Policy Storage: warga boleh upload foto, foto boleh dibaca publik
--    Dibuat ulang dari bersih agar tidak menumpuk policy duplikat.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Siapapun boleh upload foto EWS" ON storage.objects;
DROP POLICY IF EXISTS "Foto EWS bisa dibaca publik"    ON storage.objects;

CREATE POLICY "Siapapun boleh upload foto EWS"
    ON storage.objects FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'ews-foto');

CREATE POLICY "Foto EWS bisa dibaca publik"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'ews-foto');


-- ---------------------------------------------------------------------
-- 3. Bersihkan baris uji diagnostik
--    Hanya menghapus baris bertanda "ZZ-DIAGNOSTIK" — data laporan asli
--    dari warga tidak akan tersentuh.
-- ---------------------------------------------------------------------
DELETE FROM public.ews_laporan_rt004
WHERE nama_pelapor = 'ZZ-DIAGNOSTIK'
  AND deskripsi LIKE 'TES DIAGNOSTIK RLS%';


-- ---------------------------------------------------------------------
-- 4. VERIFIKASI — semua baris harus berstatus 'OK'
-- ---------------------------------------------------------------------
WITH pemeriksaan AS (
    -- Bucket penyimpanan foto
    SELECT
        1 AS urut,
        'Bucket ews-foto' AS item,
        CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ews-foto')
             THEN 'OK' ELSE 'GAGAL - bucket belum ada' END AS status

    UNION ALL
    -- Policy upload foto (anon)
    SELECT
        2,
        'Policy upload foto EWS',
        CASE WHEN EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'storage' AND tablename = 'objects'
                  AND policyname = 'Siapapun boleh upload foto EWS'
             ) THEN 'OK' ELSE 'GAGAL - policy belum terbentuk' END

    UNION ALL
    -- Policy baca foto
    SELECT
        3,
        'Policy baca foto EWS',
        CASE WHEN EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'storage' AND tablename = 'objects'
                  AND policyname = 'Foto EWS bisa dibaca publik'
             ) THEN 'OK' ELSE 'GAGAL - policy belum terbentuk' END

    UNION ALL
    -- Policy INSERT laporan untuk anon (warga tanpa login)
    SELECT
        4,
        'Policy kirim laporan EWS (anon)',
        CASE WHEN EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'ews_laporan_rt004'
                  AND cmd = 'INSERT' AND 'anon' = ANY (roles)
             ) THEN 'OK' ELSE 'GAGAL - jalankan setup-skema-utama.sql' END

    UNION ALL
    -- SELECT laporan HARUS tertutup untuk anon (privasi pelapor)
    SELECT
        5,
        'SELECT laporan tertutup untuk anon',
        CASE WHEN NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'ews_laporan_rt004'
                  AND cmd = 'SELECT' AND 'anon' = ANY (roles)
             ) THEN 'OK' ELSE 'BAHAYA - data pelapor bisa dibaca publik' END

    UNION ALL
    -- RLS wajib aktif
    SELECT
        6,
        'RLS aktif di ews_laporan_rt004',
        CASE WHEN EXISTS (
                SELECT 1 FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'ews_laporan_rt004'
                  AND c.relrowsecurity
             ) THEN 'OK' ELSE 'BAHAYA - RLS mati' END

    UNION ALL
    -- Sisa baris uji diagnostik
    SELECT
        7,
        'Baris uji diagnostik terhapus',
        CASE WHEN NOT EXISTS (
                SELECT 1 FROM public.ews_laporan_rt004
                WHERE nama_pelapor = 'ZZ-DIAGNOSTIK'
             ) THEN 'OK' ELSE 'GAGAL - masih ada' END

    UNION ALL
    -- Realtime untuk notifikasi laporan baru ke dashboard pengurus
    SELECT
        8,
        'Realtime laporan EWS aktif',
        CASE WHEN EXISTS (
                SELECT 1 FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime'
                  AND schemaname = 'public'
                  AND tablename = 'ews_laporan_rt004'
             ) THEN 'OK' ELSE 'PERHATIAN - dashboard tidak update otomatis' END
)
SELECT item AS pemeriksaan, status
FROM pemeriksaan
ORDER BY urut;
