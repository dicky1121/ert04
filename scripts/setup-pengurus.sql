-- =====================================================================
-- SIP RT 004 RW 007 Jatimulya
-- Setup 3 akun pengurus dengan akses penuh:
--   1. ADMIN_SISTEM      -> Administrator Sistem
--   2. ADMIN_KETUA_RT    -> Ketua RT 004 (Admin Utama)
--   3. ADMIN_SEKRETARIS  -> Sekretaris RT 004
--
-- CARA PAKAI:
--   1. Buat dulu 3 user di Supabase Dashboard:
--      Authentication > Users > Add user > Create new user
--      (centang "Auto Confirm User" untuk masing-masing)
--   2. Ganti 3 email di BAGIAN 2 di bawah agar sama persis dengan
--      email yang Anda pakai di langkah 1.
--   3. Salin SELURUH isi file ini ke Supabase SQL Editor, lalu klik Run.
--
-- Script ini aman dijalankan berulang kali (idempoten): menjalankannya
-- dua kali tidak membuat data ganda, hanya memperbarui role.
--
-- CATATAN: kolom `username` bersifat UNIQUE. Bila di tabel sudah ada
-- profil lama dengan username yang sama tetapi milik akun (UID) berbeda,
-- akan muncul error duplicate key. Ganti saja username di script ini,
-- atau hapus profil lama tersebut lebih dulu.
-- =====================================================================


-- =====================================================================
-- BAGIAN 1: Perbarui fungsi izin agar mengenali ADMIN_SISTEM
-- ---------------------------------------------------------------------
-- Fungsi ini dipakai oleh semua policy DELETE (warga, KK, surat, mutasi).
-- Tanpa ini, akun ADMIN_SISTEM bisa login tetapi tidak bisa hapus data.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_admin_rt()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pengurus_profil p
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
      AND p.role IN ('ADMIN_KETUA_RT', 'ADMIN_SEKRETARIS', 'ADMIN_SISTEM')
  );
$$;


-- =====================================================================
-- BAGIAN 2: Daftarkan profil & role ketiga akun
-- ---------------------------------------------------------------------
-- UID diambil otomatis dari auth.users berdasarkan email, jadi Anda
-- TIDAK perlu menyalin UID satu per satu.
-- GANTI email, username, dan nama lengkap sesuai data sebenarnya.
-- =====================================================================

-- ---------- 1. Administrator Sistem ----------
INSERT INTO pengurus_profil (id, username, nama_lengkap, role, role_label, email, is_active)
SELECT
  u.id,
  'admin_sistem',                 -- username (tanpa spasi)
  'Nama Administrator',           -- GANTI nama lengkap
  'ADMIN_SISTEM',                 -- JANGAN diubah
  'Administrator Sistem',         -- JANGAN diubah
  u.email,
  TRUE
FROM auth.users u
WHERE u.email = 'adminsistem@rt004.id'   -- GANTI email
ON CONFLICT (id) DO UPDATE SET
  role       = EXCLUDED.role,
  role_label = EXCLUDED.role_label,
  is_active  = TRUE;

-- ---------- 2. Ketua RT ----------
INSERT INTO pengurus_profil (id, username, nama_lengkap, role, role_label, email, is_active)
SELECT
  u.id,
  'ketua_rt004',                  -- username
  'Nama Ketua RT',                -- GANTI nama lengkap
  'ADMIN_KETUA_RT',               -- JANGAN diubah
  'Ketua RT 004 (Admin Utama)',   -- JANGAN diubah
  u.email,
  TRUE
FROM auth.users u
WHERE u.email = 'ketua@rt004.id'         -- GANTI email
ON CONFLICT (id) DO UPDATE SET
  role       = EXCLUDED.role,
  role_label = EXCLUDED.role_label,
  is_active  = TRUE;

-- ---------- 3. Sekretaris ----------
INSERT INTO pengurus_profil (id, username, nama_lengkap, role, role_label, email, is_active)
SELECT
  u.id,
  'sekretaris_rt004',             -- username
  'Nama Sekretaris',              -- GANTI nama lengkap
  'ADMIN_SEKRETARIS',             -- JANGAN diubah
  'Sekretaris RT 004',            -- JANGAN diubah
  u.email,
  TRUE
FROM auth.users u
WHERE u.email = 'sekretaris@rt004.id'    -- GANTI email
ON CONFLICT (id) DO UPDATE SET
  role       = EXCLUDED.role,
  role_label = EXCLUDED.role_label,
  is_active  = TRUE;


-- =====================================================================
-- BAGIAN 3: Verifikasi hasil
-- ---------------------------------------------------------------------
-- Harus muncul 3 baris dengan is_active = true.
-- Kolom status_akun bernilai 'OK' bila profil sudah terhubung ke akun login.
-- =====================================================================

SELECT
  p.username,
  p.nama_lengkap,
  p.role,
  p.role_label,
  p.is_active,
  CASE WHEN u.id IS NULL THEN 'AKUN LOGIN TIDAK DITEMUKAN' ELSE 'OK' END AS status_akun
FROM pengurus_profil p
LEFT JOIN auth.users u ON u.id = p.id
ORDER BY p.role;
