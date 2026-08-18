-- =====================================================================
-- E-RT04 - CEK FINAL SETELAH setup-skema-utama.sql (READ-ONLY / AMAN)
-- ---------------------------------------------------------------------
-- Skrip ini HANYA MEMBACA. Tidak membuat/mengubah/menghapus apa pun.
--
-- Kenapa file ini ada: Supabase SQL Editor hanya menampilkan hasil dari
-- statement TERAKHIR. File cek-status-database.sql berisi 6 SELECT
-- terpisah, sehingga 5 hasil pertama tidak terlihat. Di sini semuanya
-- digabung dengan UNION ALL menjadi SATU tabel hasil.
--
-- Cara pakai: copy seluruh isi file ini ke Supabase SQL Editor > Run,
-- lalu baca kolom "status". Semua baris seharusnya berawalan "OK".
-- =====================================================================

WITH
-- 1. Keberadaan 8 tabel inti -----------------------------------------
tabel AS (
    SELECT
        '1. TABEL' AS bagian,
        t.nama     AS objek,
        CASE WHEN c.table_name IS NULL THEN 'BELUM ADA' ELSE 'OK - ada' END AS status
    FROM (VALUES
        ('kartu_keluarga_rt004'), ('warga_rt004'), ('surat_pengantar_rt004'),
        ('mutasi_penduduk_rt004'), ('pengurus_profil'), ('konfigurasi_rt004'),
        ('ews_laporan_rt004'), ('ews_fcm_tokens')
    ) AS t(nama)
    LEFT JOIN information_schema.tables c
           ON c.table_schema = 'public' AND c.table_name = t.nama
),

-- 2. Fungsi helper RLS ------------------------------------------------
fungsi AS (
    SELECT
        '2. FUNGSI RLS' AS bagian,
        f.nama          AS objek,
        CASE WHEN p.proname IS NULL THEN 'BELUM ADA' ELSE 'OK - ada' END AS status
    FROM (VALUES ('is_pengurus_aktif'), ('is_admin_rt')) AS f(nama)
    LEFT JOIN pg_proc p
           ON p.proname = f.nama
          AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
),

-- 3. RLS aktif + jumlah policy per tabel ------------------------------
-- Jumlah policy yang diharapkan dari setup-skema-utama.sql:
--   4 tabel data (KK/warga/surat/mutasi) = 4 policy masing-masing
--   konfigurasi_rt004 = 3, pengurus_profil = 2
--   ews_laporan_rt004 = 3, ews_fcm_tokens = 3
keamanan AS (
    SELECT
        '3. RLS + POLICY' AS bagian,
        c.relname || ' (' || (
            SELECT count(*) FROM pg_policies pol
            WHERE pol.schemaname = 'public' AND pol.tablename = c.relname
        )::text || ' policy)' AS objek,
        CASE
            WHEN NOT c.relrowsecurity
                THEN 'BAHAYA - RLS mati, data terbuka untuk anon'
            WHEN (SELECT count(*) FROM pg_policies pol
                   WHERE pol.schemaname = 'public' AND pol.tablename = c.relname) = 0
                THEN 'MASALAH - RLS aktif tapi 0 policy, semua akses tertolak'
            ELSE 'OK - RLS aktif + ada policy'
        END AS status
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN (
          'kartu_keluarga_rt004', 'warga_rt004', 'surat_pengantar_rt004',
          'mutasi_penduduk_rt004', 'pengurus_profil', 'konfigurasi_rt004',
          'ews_laporan_rt004', 'ews_fcm_tokens'
      )
),

-- 4. Bucket Storage untuk foto laporan EWS ----------------------------
bucket AS (
    SELECT
        '4. STORAGE' AS bagian,
        'bucket ews-foto' AS objek,
        CASE
            WHEN b.id IS NULL THEN 'BELUM ADA - upload foto EWS akan gagal'
            ELSE 'OK - ada (limit ' || COALESCE(b.file_size_limit, 0) / 1024 / 1024 || ' MB)'
        END AS status
    FROM (SELECT 1) dummy
    LEFT JOIN storage.buckets b ON b.id = 'ews-foto'
),

-- 5. Tabel yang ikut publikasi Realtime -------------------------------
realtime AS (
    SELECT
        '5. REALTIME' AS bagian,
        r.nama AS objek,
        CASE WHEN pt.tablename IS NULL
             THEN 'BELUM masuk publikasi - perubahan tidak terkirim live'
             ELSE 'OK - realtime aktif'
        END AS status
    FROM (VALUES
        ('kartu_keluarga_rt004'), ('warga_rt004'), ('surat_pengantar_rt004'),
        ('mutasi_penduduk_rt004'), ('konfigurasi_rt004'), ('ews_laporan_rt004')
    ) AS r(nama)
    LEFT JOIN pg_publication_tables pt
           ON pt.pubname = 'supabase_realtime'
          AND pt.schemaname = 'public'
          AND pt.tablename = r.nama
),

-- 6. Akun pengurus (wajib ada minimal 1 yang aktif untuk bisa login) --
akun AS (
    SELECT
        '6. AKUN PENGURUS' AS bagian,
        'jumlah pengurus aktif' AS objek,
        CASE
            WHEN count(*) FILTER (WHERE p.is_active) = 0
                THEN 'BELUM ADA - jalankan setup-pengurus.sql, tidak bisa login'
            ELSE 'OK - ' || count(*) FILTER (WHERE p.is_active)::text || ' akun aktif'
        END AS status
    FROM pengurus_profil p
)

SELECT bagian, objek, status FROM tabel
UNION ALL SELECT bagian, objek, status FROM fungsi
UNION ALL SELECT bagian, objek, status FROM keamanan
UNION ALL SELECT bagian, objek, status FROM bucket
UNION ALL SELECT bagian, objek, status FROM realtime
UNION ALL SELECT bagian, objek, status FROM akun
ORDER BY bagian, objek;
