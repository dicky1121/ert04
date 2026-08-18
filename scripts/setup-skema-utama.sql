-- =====================================================================
-- E-RT04 / SIP RT 004 RW 007 JATIMULYA - SKEMA UTAMA (DDL)
-- ---------------------------------------------------------------------
-- LANGKAH PERTAMA setup Supabase. Jalankan file ini di Supabase SQL
-- Editor SEBELUM skrip lain di folder scripts/.
--
-- Isi file ini identik dengan output tombol "Skema Tabel (DDL)" pada
-- tab Integrasi di dalam aplikasi (supabaseService.generateSQLSchema),
-- diekstrak ke file agar tidak perlu menjalankan dev server dulu.
--
-- Urutan setup lengkap:
--   1. setup-skema-utama.sql        <-- file ini
--   2. (buat 3 user di Authentication > Users, centang Auto Confirm)
--   3. setup-pengurus.sql          (edit email di BAGIAN 2 dulu)
--   4. setup-public-submission.sql
--   5. setup-konfigurasi-sync.sql
--   6. setup-sapa-warga.sql
--   7. setup-ews.sql               (opsional, fitur EWS)
--
-- Aman dijalankan berulang kali (semua CREATE ... IF NOT EXISTS).
-- =====================================================================

-- SQL SCHEMA UNTUK SISTEM KEPENDUDUKAN RT 004 RW 007 KELURAHAN JATIMULYA
-- Jalankan perintah SQL berikut di Supabase SQL Editor:

-- 1. Tabel Kartu Keluarga
CREATE TABLE IF NOT EXISTS kartu_keluarga_rt004 (
    id TEXT PRIMARY KEY,
    nomor_kk VARCHAR(30) UNIQUE NOT NULL,
    kepala_keluarga_nama TEXT NOT NULL,
    kepala_keluarga_nik VARCHAR(30) NOT NULL,
    alamat TEXT NOT NULL,
    rt VARCHAR(10) DEFAULT '004',
    rw VARCHAR(10) DEFAULT '007',
    kelurahan VARCHAR(100) DEFAULT 'Jatimulya',
    kecamatan VARCHAR(100) DEFAULT 'Tambun Selatan',
    kabupaten_kota VARCHAR(100) DEFAULT 'Kabupaten Bekasi',
    provinsi VARCHAR(100) DEFAULT 'Jawa Barat',
    kode_pos VARCHAR(20) DEFAULT '17510',
    status_domisili VARCHAR(30) DEFAULT 'TETAP',
    blok_rumah VARCHAR(100),
    tanggal_terbit DATE,
    tanggal_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    catatan TEXT
);

-- 2. Tabel Data Warga / Penduduk
CREATE TABLE IF NOT EXISTS warga_rt004 (
    id TEXT PRIMARY KEY,
    nik VARCHAR(30) UNIQUE NOT NULL,
    nomor_kk VARCHAR(30),
    nama TEXT NOT NULL,
    jenis_kelamin VARCHAR(10),
    tempat_lahir TEXT,
    tanggal_lahir DATE,
    agama VARCHAR(50) DEFAULT 'ISLAM',
    pendidikan VARCHAR(100),
    pekerjaan VARCHAR(150),
    status_perkawinan VARCHAR(50),
    status_hubungan_kk VARCHAR(50),
    kewarganegaraan VARCHAR(30) DEFAULT 'WNI',
    golongan_darah VARCHAR(10) DEFAULT '-',
    nomor_hp VARCHAR(50),
    email TEXT,
    status_tinggal VARCHAR(50) DEFAULT 'TETAP',
    is_lansia BOOLEAN DEFAULT FALSE,
    is_balita BOOLEAN DEFAULT FALSE,
    is_yatim BOOLEAN DEFAULT FALSE,
    is_disabilitas BOOLEAN DEFAULT FALSE,
    status_bansos VARCHAR(50) DEFAULT 'TIDAK_ADA',
    keterangan_bansos TEXT,
    tanggal_input DATE DEFAULT CURRENT_DATE,
    catatan TEXT
);

-- 3. Tabel Surat Pengantar RT
CREATE TABLE IF NOT EXISTS surat_pengantar_rt004 (
    id TEXT PRIMARY KEY,
    nomor_surat VARCHAR(100) UNIQUE NOT NULL,
    jenis_surat VARCHAR(30) NOT NULL,
    judul_surat TEXT NOT NULL,
    nik_pemohon VARCHAR(16) NOT NULL,
    nama_pemohon TEXT NOT NULL,
    nomor_kk_pemohon VARCHAR(16),
    tempat_tgl_lahir_pemohon TEXT,
    jenis_kelamin_pemohon VARCHAR(1),
    agama_pemohon VARCHAR(20),
    pekerjaan_pemohon VARCHAR(100),
    status_kawin_pemohon VARCHAR(30),
    telepon_pemohon VARCHAR(30),
    alamat_pemohon TEXT,
    keperluan TEXT NOT NULL,
    keterangan_lain TEXT,
    tanggal_pengajuan DATE DEFAULT CURRENT_DATE,
    tanggal_disetujui DATE,
    status VARCHAR(20) DEFAULT 'PENDING',
    alasan_penolakan TEXT,
    nama_pejabat_ttd TEXT,
    jabatan_ttd TEXT,
    kode_verifikasi_qr TEXT,
    dibuat_oleh VARCHAR(20) DEFAULT 'WARGA',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabel Mutasi Penduduk (Pindah Masuk / Keluar / Lahir / Wafat)
CREATE TABLE IF NOT EXISTS mutasi_penduduk_rt004 (
    id TEXT PRIMARY KEY,
    tanggal DATE DEFAULT CURRENT_DATE,
    jenis_mutasi VARCHAR(30) NOT NULL,
    nik VARCHAR(16),
    nama_warga TEXT NOT NULL,
    nomor_kk VARCHAR(16),
    alamat_asal TEXT,
    alamat_tujuan TEXT,
    alasan TEXT,
    no_surat_keterangan TEXT,
    petugas TEXT,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabel Profil Pengurus RT (terhubung ke Supabase Auth)
--    PENTING: password TIDAK disimpan di sini. Password dikelola sepenuhnya
--    oleh Supabase Auth (auth.users) yang menyimpannya dalam bentuk hash.
CREATE TABLE IF NOT EXISTS pengurus_profil (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE NOT NULL,
    nama_lengkap TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'STAF_PELAYANAN',
    role_label TEXT,
    nomor_hp VARCHAR(50),
    email TEXT,
    jabatan_khusus TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    terakhir_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Konfigurasi global template, kop, dan logo surat
CREATE TABLE IF NOT EXISTS konfigurasi_rt004 (
    id TEXT PRIMARY KEY DEFAULT 'global',
    config_data JSONB NOT NULL DEFAULT '{}'::JSONB,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- KEAMANAN: ROW LEVEL SECURITY (RLS)
-- Anon key ikut ter-bundle ke JavaScript browser, jadi anon TIDAK BOLEH
-- punya akses apa pun ke data warga. Semua akses wajib melewati
-- Supabase Auth (login pengurus) + profil pengurus yang aktif.
-- =====================================================================

-- Fungsi bantu: cek apakah user yang login adalah pengurus aktif.
-- SECURITY DEFINER + search_path tetap agar aman dipakai di dalam policy
-- dan tidak menimbulkan rekursi RLS saat membaca pengurus_profil.
CREATE OR REPLACE FUNCTION public.is_pengurus_aktif()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pengurus_profil p
    WHERE p.id = auth.uid() AND p.is_active = TRUE
  );
$$;

-- Fungsi bantu: cek apakah user yang login punya peran admin penuh
-- (berhak menghapus data).
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

ALTER TABLE kartu_keluarga_rt004 ENABLE ROW LEVEL SECURITY;
ALTER TABLE warga_rt004 ENABLE ROW LEVEL SECURITY;
ALTER TABLE surat_pengantar_rt004 ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutasi_penduduk_rt004 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_profil ENABLE ROW LEVEL SECURITY;
ALTER TABLE konfigurasi_rt004 ENABLE ROW LEVEL SECURITY;

-- Bersihkan SEMUA policy lama pada tabel-tabel ini, termasuk policy publik
-- "Public full access for RT004" (USING (true)) dari skema versi sebelumnya.
-- Memakai blok DO agar skrip ini aman dijalankan berulang: tabel yang tidak
-- ada (misalnya pengurus_rt004 yang sudah dihapus) otomatis dilewati, dan
-- CREATE POLICY di bawah tidak akan bentrok dengan policy bernama sama.
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'kartu_keluarga_rt004',
              'warga_rt004',
              'surat_pengantar_rt004',
              'mutasi_penduduk_rt004',
              'konfigurasi_rt004',
              'pengurus_profil',
              'pengurus_rt004',
              'ews_laporan_rt004',
              'ews_fcm_tokens'
          )
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            pol.policyname, pol.schemaname, pol.tablename
        );
    END LOOP;
END $$;


-- Cabut hak akses anon (pengguna belum login) dari seluruh tabel data.
REVOKE ALL ON kartu_keluarga_rt004 FROM anon;
REVOKE ALL ON warga_rt004 FROM anon;
REVOKE ALL ON surat_pengantar_rt004 FROM anon;
REVOKE ALL ON mutasi_penduduk_rt004 FROM anon;
REVOKE ALL ON pengurus_profil FROM anon;
REVOKE ALL ON konfigurasi_rt004 FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON kartu_keluarga_rt004 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON warga_rt004 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON surat_pengantar_rt004 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mutasi_penduduk_rt004 TO authenticated;
GRANT SELECT, UPDATE ON pengurus_profil TO authenticated;
GRANT SELECT, INSERT, UPDATE ON konfigurasi_rt004 TO authenticated;

-- Policy data warga & KK: baca/tulis hanya untuk pengurus aktif,
-- hapus hanya untuk Ketua RT / Sekretaris.
CREATE POLICY "Pengurus aktif boleh baca KK" ON kartu_keluarga_rt004
    FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh tambah KK" ON kartu_keluarga_rt004
    FOR INSERT TO authenticated WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh ubah KK" ON kartu_keluarga_rt004
    FOR UPDATE TO authenticated USING (public.is_pengurus_aktif()) WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh hapus KK" ON kartu_keluarga_rt004
    FOR DELETE TO authenticated USING (public.is_admin_rt());

CREATE POLICY "Pengurus aktif boleh baca warga" ON warga_rt004
    FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh tambah warga" ON warga_rt004
    FOR INSERT TO authenticated WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh ubah warga" ON warga_rt004
    FOR UPDATE TO authenticated USING (public.is_pengurus_aktif()) WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh hapus warga" ON warga_rt004
    FOR DELETE TO authenticated USING (public.is_admin_rt());

CREATE POLICY "Pengurus aktif boleh baca surat" ON surat_pengantar_rt004
    FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh tambah surat" ON surat_pengantar_rt004
    FOR INSERT TO authenticated WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh ubah surat" ON surat_pengantar_rt004
    FOR UPDATE TO authenticated USING (public.is_pengurus_aktif()) WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh hapus surat" ON surat_pengantar_rt004
    FOR DELETE TO authenticated USING (public.is_admin_rt());

CREATE POLICY "Pengurus aktif boleh baca mutasi" ON mutasi_penduduk_rt004
    FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh tambah mutasi" ON mutasi_penduduk_rt004
    FOR INSERT TO authenticated WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh ubah mutasi" ON mutasi_penduduk_rt004
    FOR UPDATE TO authenticated USING (public.is_pengurus_aktif()) WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh hapus mutasi" ON mutasi_penduduk_rt004
    FOR DELETE TO authenticated USING (public.is_admin_rt());

-- Seluruh pengurus aktif melihat format yang sama. Perubahan template dan
-- logo hanya dapat dilakukan oleh tiga role admin penuh.
CREATE POLICY "Pengurus aktif boleh baca konfigurasi" ON konfigurasi_rt004
    FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh tambah konfigurasi" ON konfigurasi_rt004
    FOR INSERT TO authenticated WITH CHECK (public.is_admin_rt() AND id = 'global');
CREATE POLICY "Admin RT boleh ubah konfigurasi" ON konfigurasi_rt004
    FOR UPDATE TO authenticated USING (public.is_admin_rt()) WITH CHECK (public.is_admin_rt() AND id = 'global');

-- Policy profil pengurus: setiap pengurus hanya bisa melihat & mengubah
-- profilnya sendiri; role tidak bisa dinaikkan sendiri (lihat trigger di bawah).
CREATE POLICY "Pengurus baca profil sendiri" ON pengurus_profil
    FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Pengurus ubah profil sendiri" ON pengurus_profil
    FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Cegah pengurus mengubah role / status aktifnya sendiri (privilege escalation).
-- Perubahan role hanya boleh dilakukan dari Supabase Dashboard (service role).
CREATE OR REPLACE FUNCTION public.cegah_ubah_role_sendiri()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id AND (NEW.role <> OLD.role OR NEW.is_active <> OLD.is_active) THEN
    RAISE EXCEPTION 'Role dan status aktif tidak dapat diubah sendiri. Hubungi Ketua RT.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cegah_ubah_role_sendiri ON pengurus_profil;
CREATE TRIGGER trg_cegah_ubah_role_sendiri
    BEFORE UPDATE ON pengurus_profil
    FOR EACH ROW EXECUTE FUNCTION public.cegah_ubah_role_sendiri();

-- =====================================================================
-- LANGKAH TERAKHIR: BUAT AKUN PENGURUS
-- 1. Buka Supabase Dashboard > Authentication > Users > "Add user",
--    isi email & password pengurus (aktifkan "Auto Confirm User").
-- 2. Salin User UID yang muncul, lalu jalankan INSERT berikut
--    (ganti UID, email, nama, dan role sesuai jabatan):
--
-- INSERT INTO pengurus_profil (id, username, nama_lengkap, role, role_label, email)
-- VALUES ('UUID-DARI-DASHBOARD', 'ketua_rt004', 'Yanto', 'ADMIN_KETUA_RT', 'Ketua RT 004 (Admin Utama)', 'ketua.rt004@contoh.id');
--
-- Role dengan akses penuh (bisa mengatur semua konfigurasi & menghapus data):
--   ADMIN_KETUA_RT   -> Ketua RT 004 (Admin Utama)
--   ADMIN_SEKRETARIS -> Sekretaris RT 004
--   ADMIN_SISTEM     -> Administrator Sistem
-- Role dengan akses terbatas (tanpa hak hapus data):
--   BENDAHARA, SEKSI_KEAMANAN, STAF_PELAYANAN

-- 3. Tabel lama pengurus_rt004 (jika ada) sebaiknya dihapus karena
--    menyimpan PIN dalam bentuk teks biasa:
--    DROP TABLE IF EXISTS pengurus_rt004;
-- =====================================================================

-- =====================================================================
-- REALTIME ANTARPERANGKAT
-- Metadata perubahan membantu audit teknis dan REPLICA IDENTITY FULL
-- memastikan payload DELETE membawa identitas baris yang diperlukan.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_sync_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'kartu_keluarga_rt004',
    'warga_rt004',
    'surat_pengantar_rt004',
    'mutasi_penduduk_rt004',
    'konfigurasi_rt004'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      table_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL',
      table_name
    );
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_sync_metadata ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_set_sync_metadata BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata()',
      table_name
    );

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END $$;
-- =====================================================================

-- =====================================================================
-- EWS (EARLY WARNING SYSTEM) — Fitur Android App
-- =====================================================================

-- Tabel laporan darurat dari warga
CREATE TABLE IF NOT EXISTS ews_laporan_rt004 (
    id             TEXT        PRIMARY KEY DEFAULT 'EWS-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6)),
    jenis_kejadian VARCHAR(30) NOT NULL,
    deskripsi      TEXT        NOT NULL,
    nama_pelapor   TEXT        NOT NULL,
    alamat         TEXT        NOT NULL,
    foto_url       TEXT        NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'BARU',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabel FCM tokens device Android
CREATE TABLE IF NOT EXISTS ews_fcm_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    token       TEXT        UNIQUE NOT NULL,
    device_info TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ews_laporan_rt004 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ews_fcm_tokens    ENABLE ROW LEVEL SECURITY;

GRANT INSERT                  ON ews_laporan_rt004 TO anon;
GRANT SELECT, INSERT, UPDATE  ON ews_laporan_rt004 TO authenticated;
GRANT INSERT, UPDATE          ON ews_fcm_tokens TO anon;
GRANT SELECT, INSERT, UPDATE  ON ews_fcm_tokens TO authenticated;

CREATE POLICY "Siapapun boleh kirim laporan EWS"   ON ews_laporan_rt004 FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Pengurus aktif boleh baca laporan EWS" ON ews_laporan_rt004 FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh update status EWS" ON ews_laporan_rt004 FOR UPDATE TO authenticated USING (public.is_pengurus_aktif()) WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Siapapun boleh daftar FCM token"    ON ews_fcm_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Siapapun boleh update FCM token"    ON ews_fcm_tokens FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Pengurus aktif boleh baca FCM tokens" ON ews_fcm_tokens FOR SELECT TO authenticated USING (public.is_pengurus_aktif());

CREATE OR REPLACE FUNCTION public.set_ews_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$ BEGIN NEW.updated_at := NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_ews_laporan_updated_at ON ews_laporan_rt004;
CREATE TRIGGER trg_ews_laporan_updated_at BEFORE UPDATE ON ews_laporan_rt004 FOR EACH ROW EXECUTE FUNCTION public.set_ews_updated_at();

DROP TRIGGER IF EXISTS trg_ews_token_updated_at ON ews_fcm_tokens;
CREATE TRIGGER trg_ews_token_updated_at BEFORE UPDATE ON ews_fcm_tokens FOR EACH ROW EXECUTE FUNCTION public.set_ews_updated_at();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ews_laporan_rt004') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ews_laporan_rt004;
  END IF;
END $$;

-- Storage bucket untuk foto laporan EWS (max 2MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ews-foto', 'ews-foto', true, 2097152, ARRAY['image/jpeg','image/jpg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
-- =====================================================================
