-- =====================================================================
-- E-RT04 - CEK STATUS DATABASE (READ-ONLY / AMAN)
-- ---------------------------------------------------------------------
-- Skrip ini HANYA MEMBACA. Tidak membuat, mengubah, atau menghapus
-- apa pun. Gunakan untuk mengetahui bagian setup mana yang sudah jalan
-- dan mana yang belum, terutama bila sebelumnya sudah pernah
-- menjalankan skema SQL versi lain.
--
-- Cara pakai: copy seluruh isi file ini ke Supabase SQL Editor, Run.
-- Baca kolom "status" pada tiap bagian hasil.
-- =====================================================================


-- ---------------------------------------------------------------------
-- BAGIAN 1: Apakah 8 tabel inti sudah ada?
-- ---------------------------------------------------------------------
SELECT
    '1. TABEL INTI'                                  AS bagian,
    t.nama_tabel,
    CASE WHEN c.table_name IS NULL
         THEN 'BELUM ADA - akan dibuat setup-skema-utama.sql'
         ELSE 'SUDAH ADA'
    END                                              AS status,
    COALESCE((
        SELECT count(*)
        FROM information_schema.columns col
        WHERE col.table_schema = 'public'
          AND col.table_name   = t.nama_tabel
    ), 0)                                            AS jumlah_kolom
FROM (VALUES
    ('kartu_keluarga_rt004'),
    ('warga_rt004'),
    ('surat_pengantar_rt004'),
    ('mutasi_penduduk_rt004'),
    ('pengurus_profil'),
    ('konfigurasi_rt004'),
    ('ews_laporan_rt004'),
    ('ews_fcm_tokens')
) AS t(nama_tabel)
LEFT JOIN information_schema.tables c
       ON c.table_schema = 'public'
      AND c.table_name   = t.nama_tabel
ORDER BY t.nama_tabel;


-- ---------------------------------------------------------------------
-- BAGIAN 2: Apakah fungsi helper RLS sudah ada?
-- Fungsi ini dibuat oleh setup-pengurus.sql dan dipakai oleh policy
-- di skrip-skrip berikutnya. Kalau BELUM ADA, setup-sapa-warga.sql
-- pasti gagal dengan RAISE EXCEPTION.
-- ---------------------------------------------------------------------
SELECT
    '2. FUNGSI RLS'                                  AS bagian,
    f.nama_fungsi,
    CASE WHEN p.proname IS NULL
         THEN 'BELUM ADA - jalankan setup-pengurus.sql'
         ELSE 'SUDAH ADA'
    END                                              AS status
FROM (VALUES
    ('is_pengurus_aktif'),
    ('is_admin_rt')
) AS f(nama_fungsi)
LEFT JOIN pg_proc p
       ON p.proname = f.nama_fungsi
      AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY f.nama_fungsi;


-- ---------------------------------------------------------------------
-- BAGIAN 3: Status RLS + jumlah policy per tabel.
-- rls_aktif = false berarti tabel TERBUKA untuk siapa pun yang punya
-- anon key. Semua tabel di bawah ini seharusnya true.
-- ---------------------------------------------------------------------
SELECT
    '3. KEAMANAN RLS'                                AS bagian,
    c.relname                                        AS nama_tabel,
    c.relrowsecurity                                 AS rls_aktif,
    (SELECT count(*) FROM pg_policies pol
      WHERE pol.schemaname = 'public'
        AND pol.tablename  = c.relname)              AS jumlah_policy,
    CASE
        WHEN NOT c.relrowsecurity THEN 'BAHAYA - RLS mati, data bisa dibaca publik'
        WHEN (SELECT count(*) FROM pg_policies pol
               WHERE pol.schemaname = 'public'
                 AND pol.tablename  = c.relname) = 0 THEN 'RLS aktif tapi belum ada policy'
        ELSE 'AMAN'
    END                                              AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
      'kartu_keluarga_rt004', 'warga_rt004', 'surat_pengantar_rt004',
      'mutasi_penduduk_rt004', 'pengurus_profil', 'konfigurasi_rt004',
      'ews_laporan_rt004', 'ews_fcm_tokens'
  )
ORDER BY c.relname;


-- ---------------------------------------------------------------------
-- BAGIAN 4: Akun pengurus yang terdaftar.
-- Kosong = setup-pengurus.sql BAGIAN 2 belum dijalankan / email belum
-- cocok dengan user di Authentication > Users.
-- ---------------------------------------------------------------------
SELECT
    '4. AKUN PENGURUS'                               AS bagian,
    p.username,
    p.nama_lengkap,
    p.role,
    p.role_label,
    p.is_active,
    CASE WHEN u.id IS NULL
         THEN 'ORPHAN - user di Authentication sudah dihapus'
         WHEN u.email_confirmed_at IS NULL
         THEN 'EMAIL BELUM DIKONFIRMASI - centang Auto Confirm'
         WHEN NOT p.is_active
         THEN 'TIDAK AKTIF - is_active = false'
         ELSE 'OK'
    END                                              AS status_akun
FROM pengurus_profil p
LEFT JOIN auth.users u ON u.id = p.id
ORDER BY p.username;


-- ---------------------------------------------------------------------
-- BAGIAN 4b: Daftar kolom pengurus_profil yang ADA di database ini.
-- Berguna untuk membandingkan dengan skema versi baru bila dulu pernah
-- menjalankan skema versi lain.
-- ---------------------------------------------------------------------
SELECT
    '4b. KOLOM pengurus_profil'                      AS bagian,
    ordinal_position                                 AS urutan,
    column_name                                      AS nama_kolom,
    data_type                                        AS tipe_data,
    is_nullable                                      AS boleh_null
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pengurus_profil'
ORDER BY ordinal_position;


-- ---------------------------------------------------------------------
-- BAGIAN 5: Jumlah baris data (untuk tahu apakah tabel sudah terisi).
-- Memakai query_to_xml agar tabel yang belum ada otomatis dilewati,
-- bukan menggagalkan seluruh skrip.
-- ---------------------------------------------------------------------
SELECT
    '5. JUMLAH DATA'                                 AS bagian,
    t.table_name                                     AS nama_tabel,
    (xpath(
        '/row/cnt/text()',
        query_to_xml(
            format('SELECT count(*) AS cnt FROM public.%I', t.table_name),
            false, true, ''
        )
    ))[1]::text::bigint                              AS jumlah_baris
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name IN (
      'kartu_keluarga_rt004', 'warga_rt004', 'surat_pengantar_rt004',
      'mutasi_penduduk_rt004', 'konfigurasi_rt004',
      'ews_laporan_rt004', 'ews_fcm_tokens'
  )
ORDER BY t.table_name;
