-- =====================================================================
-- SIP RT 004 RW 007 - Backend Portal Publik "Sapa Warga"
-- ---------------------------------------------------------------------
-- Jalankan skrip ini di Supabase SQL Editor. Aman dijalankan berulang
-- kali (idempotent).
--
-- Prasyarat:
--   1. scripts/setup-pengurus.sql          (is_pengurus_aktif, is_admin_rt)
--   2. scripts/setup-public-submission.sql (ajukan_surat_warga)
--   3. scripts/setup-konfigurasi-sync.sql  (konfigurasi_rt004)
--
-- Yang dibuat skrip ini:
--   A. konfigurasi_publik()      -> info kontak resmi untuk pengunjung
--   B. ajukan_surat_warga()      -> ditambah pembatas laju (anti banjir)
--   C. cek_status_pengajuan()    -> lacak pengajuan pakai referensi + NIK
--   D. statistik_publik()        -> angka agregat saja, tanpa data pribadi
--   E. pengumuman_rt004          -> pengumuman lingkungan untuk warga
--   F. pengaduan_rt004           -> kanal lapor warga + kirim_pengaduan()
--
-- PENTING: tabel data warga & konfigurasi TETAP tertutup untuk role anon.
-- Portal publik hanya boleh menyentuh fungsi SECURITY DEFINER di bawah,
-- yang setiap kolomnya dipilih manual agar tidak ada data pribadi bocor.
-- =====================================================================

-- 0. Prasyarat wajib ada supaya tidak ada endpoint yang lolos tanpa RLS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_pengurus_aktif'
  ) THEN
    RAISE EXCEPTION 'Fungsi public.is_pengurus_aktif() belum ada. Jalankan scripts/setup-pengurus.sql lebih dahulu.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_rt'
  ) THEN
    RAISE EXCEPTION 'Fungsi public.is_admin_rt() belum ada. Jalankan scripts/setup-pengurus.sql lebih dahulu.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'konfigurasi_rt004'
  ) THEN
    RAISE EXCEPTION 'Tabel public.konfigurasi_rt004 belum ada. Jalankan scripts/setup-konfigurasi-sync.sql lebih dahulu.';
  END IF;
END $$;


-- =====================================================================
-- A. KONFIGURASI PUBLIK
-- ---------------------------------------------------------------------
-- Tabel konfigurasi_rt004 sengaja tertutup untuk anon, sehingga halaman
-- Sapa Warga sebelumnya selalu menampilkan alamat & kontak default yang
-- ditulis di kode. Fungsi ini membuka HANYA field yang memang sudah
-- dicetak pada kop surat resmi, bukan seluruh isi konfigurasi.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.konfigurasi_publik()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg JSONB;
BEGIN
  SELECT config_data INTO v_cfg
  FROM public.konfigurasi_rt004
  WHERE id = 'global';

  IF v_cfg IS NULL THEN
    v_cfg := '{}'::JSONB;
  END IF;

  -- Daftar putih (whitelist). Field di luar daftar ini tidak pernah
  -- dikirim ke pengunjung, termasuk kunci integrasi dan data pejabat.
  RETURN jsonb_strip_nulls(jsonb_build_object(
    'namaRT',             v_cfg ->> 'namaRT',
    'namaRW',             v_cfg ->> 'namaRW',
    'kelurahan',          v_cfg ->> 'kelurahan',
    'kecamatan',          v_cfg ->> 'kecamatan',
    'kabupatenKota',      v_cfg ->> 'kabupatenKota',
    'alamatSekretariat',  v_cfg ->> 'alamatSekretariat',
    'kontakSekretariat',  v_cfg ->> 'kontakSekretariat',
    'kontakRT',           v_cfg ->> 'kontakRT',
    'emailRT',            v_cfg ->> 'emailRT',
    'jamPelayanan',       v_cfg ->> 'jamPelayanan'
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.konfigurasi_publik() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.konfigurasi_publik() TO anon, authenticated;


-- =====================================================================
-- B. PEMBATAS LAJU PENGAJUAN SURAT
-- ---------------------------------------------------------------------
-- ajukan_surat_warga() di-grant ke anon tanpa pembatasan, sehingga satu
-- orang bisa mengirim ribuan baris dan membuat daftar surat pengurus
-- tidak terpakai. CREATE OR REPLACE di bawah mempertahankan tanda tangan
-- dan perilaku lama (frontend tidak perlu berubah), hanya menambah
-- penjagaan: jeda antar pengajuan, batas harian per NIK, dan batas
-- harian per nomor telepon.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ajukan_surat_warga(
  p_jenis_surat TEXT,
  p_nik TEXT,
  p_nama TEXT,
  p_nomor_kk TEXT,
  p_jenis_kelamin TEXT,
  p_tempat_tgl_lahir TEXT,
  p_agama TEXT,
  p_pekerjaan TEXT,
  p_status_kawin TEXT,
  p_telepon TEXT,
  p_alamat TEXT,
  p_keperluan TEXT,
  p_keterangan TEXT DEFAULT ''
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id TEXT := 'PUB-' || replace(gen_random_uuid()::TEXT, '-', '');
  v_reference TEXT := 'PGJ-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(v_id, 5, 4));
  v_allowed TEXT[] := ARRAY['KTP_KK','SKTM','DOMISILI','USAHA','NIKAH','KEMATIAN','KELAHIRAN','SKCK','IZIN_KERAMAIAN','LAINNYA'];
  v_nik TEXT := trim(p_nik);
  v_telepon TEXT := left(trim(coalesce(p_telepon, '')), 30);
  v_jeda_menit CONSTANT INT := 10;   -- jeda minimum antar pengajuan
  v_batas_harian CONSTANT INT := 3;  -- maksimum pengajuan per NIK per hari
  v_batas_telepon CONSTANT INT := 5; -- maksimum pengajuan per nomor per hari
  v_terakhir TIMESTAMPTZ;
  v_jumlah INT;
BEGIN
  IF p_jenis_surat IS NULL OR NOT (upper(trim(p_jenis_surat)) = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Jenis surat tidak valid';
  END IF;
  IF v_nik !~ '^[0-9]{16}$' OR p_nomor_kk !~ '^[0-9]{16}$' THEN
    RAISE EXCEPTION 'NIK dan nomor KK harus terdiri dari 16 digit';
  END IF;
  IF length(trim(p_nama)) < 3 OR length(trim(p_alamat)) < 10 OR length(trim(p_keperluan)) < 5 THEN
    RAISE EXCEPTION 'Nama, alamat, atau keperluan belum lengkap';
  END IF;
  IF p_jenis_kelamin NOT IN ('L', 'P') THEN
    RAISE EXCEPTION 'Jenis kelamin tidak valid';
  END IF;

  -- Jeda antar pengajuan untuk NIK yang sama.
  SELECT max(created_at) INTO v_terakhir
  FROM public.surat_pengantar_rt004
  WHERE nik_pemohon = v_nik AND dibuat_oleh = 'WARGA';

  IF v_terakhir IS NOT NULL AND v_terakhir > NOW() - (v_jeda_menit || ' minutes')::INTERVAL THEN
    RAISE EXCEPTION 'Pengajuan Anda baru saja kami terima. Mohon tunggu % menit sebelum mengirim pengajuan berikutnya.', v_jeda_menit;
  END IF;

  -- Batas harian per NIK.
  SELECT count(*) INTO v_jumlah
  FROM public.surat_pengantar_rt004
  WHERE nik_pemohon = v_nik
    AND dibuat_oleh = 'WARGA'
    AND tanggal_pengajuan = current_date;

  IF v_jumlah >= v_batas_harian THEN
    RAISE EXCEPTION 'Batas % pengajuan per hari untuk NIK ini sudah tercapai. Silakan hubungi pengurus RT bila masih ada kebutuhan lain.', v_batas_harian;
  END IF;

  -- Batas harian per nomor telepon, menutup celah ganti-ganti NIK.
  IF v_telepon <> '' THEN
    SELECT count(*) INTO v_jumlah
    FROM public.surat_pengantar_rt004
    WHERE telepon_pemohon = v_telepon
      AND dibuat_oleh = 'WARGA'
      AND tanggal_pengajuan = current_date;

    IF v_jumlah >= v_batas_telepon THEN
      RAISE EXCEPTION 'Batas pengajuan harian untuk nomor kontak ini sudah tercapai. Silakan hubungi pengurus RT secara langsung.';
    END IF;
  END IF;

  INSERT INTO public.surat_pengantar_rt004 (
    id, nomor_surat, jenis_surat, judul_surat, nik_pemohon, nama_pemohon,
    nomor_kk_pemohon, tempat_tgl_lahir_pemohon, jenis_kelamin_pemohon,
    agama_pemohon, pekerjaan_pemohon, status_kawin_pemohon, telepon_pemohon,
    alamat_pemohon, keperluan, keterangan_lain, tanggal_pengajuan, status,
    nama_pejabat_ttd, jabatan_ttd, kode_verifikasi_qr, dibuat_oleh
  ) VALUES (
    v_id, v_reference, upper(trim(p_jenis_surat)), 'PENGAJUAN SURAT WARGA', v_nik,
    left(trim(p_nama), 150), trim(p_nomor_kk), left(trim(p_tempat_tgl_lahir), 150),
    p_jenis_kelamin, left(trim(p_agama), 30), left(trim(p_pekerjaan), 100),
    left(trim(p_status_kawin), 30), v_telepon, left(trim(p_alamat), 500),
    left(trim(p_keperluan), 500), left(coalesce(trim(p_keterangan), ''), 500),
    current_date, 'PENDING', '', '', v_reference, 'WARGA'
  );

  RETURN v_reference;
END;
$$;

REVOKE ALL ON FUNCTION public.ajukan_surat_warga(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ajukan_surat_warga(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;

-- Indeks penunjang agar pemeriksaan pembatas laju tetap ringan.
CREATE INDEX IF NOT EXISTS idx_surat_rt004_nik_tanggal
  ON public.surat_pengantar_rt004 (nik_pemohon, tanggal_pengajuan);
CREATE INDEX IF NOT EXISTS idx_surat_rt004_telepon_tanggal
  ON public.surat_pengantar_rt004 (telepon_pemohon, tanggal_pengajuan);


-- =====================================================================
-- C. CEK STATUS PENGAJUAN
-- ---------------------------------------------------------------------
-- Nomor referensi memuat tanggal dan jam sehingga relatif mudah ditebak.
-- Karena itu NIK diwajibkan sebagai pasangan: keduanya harus cocok pada
-- baris yang sama. Nilai yang dikembalikan pun dibatasi pada status dan
-- catatan pengurus, tanpa alamat, nomor KK, maupun nomor telepon.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cek_status_pengajuan(
  p_referensi TEXT,
  p_nik TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_ref TEXT := upper(trim(coalesce(p_referensi, '')));
  v_nik TEXT := trim(coalesce(p_nik, ''));
BEGIN
  IF v_nik !~ '^[0-9]{16}$' THEN
    RAISE EXCEPTION 'NIK harus terdiri dari 16 digit';
  END IF;
  IF length(v_ref) < 8 THEN
    RAISE EXCEPTION 'Nomor referensi tidak valid';
  END IF;

  SELECT
    s.nomor_surat,
    s.jenis_surat,
    s.nama_pemohon,
    s.status,
    s.tanggal_pengajuan,
    s.tanggal_disetujui,
    s.alasan_penolakan,
    s.keperluan
  INTO v_row
  FROM public.surat_pengantar_rt004 s
  WHERE upper(s.nomor_surat) = v_ref
    AND s.nik_pemohon = v_nik
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ditemukan', FALSE,
      'pesan', 'Pengajuan tidak ditemukan. Pastikan nomor referensi dan NIK sesuai dengan yang Anda kirimkan.'
    );
  END IF;

  RETURN jsonb_build_object(
    'ditemukan',        TRUE,
    'referensi',        v_row.nomor_surat,
    'jenisSurat',       v_row.jenis_surat,
    -- Nama disamarkan sebagian: cukup untuk meyakinkan pemohon bahwa
    -- data yang ditemukan benar miliknya, tanpa memajang nama utuh.
    'namaPemohon',      left(v_row.nama_pemohon, 3) || repeat('*', greatest(length(v_row.nama_pemohon) - 3, 0)),
    'keperluan',        v_row.keperluan,
    'status',           v_row.status,
    'tanggalPengajuan', v_row.tanggal_pengajuan,
    'tanggalDisetujui', v_row.tanggal_disetujui,
    'alasanPenolakan',  v_row.alasan_penolakan
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cek_status_pengajuan(TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cek_status_pengajuan(TEXT,TEXT) TO anon, authenticated;


-- =====================================================================
-- D. STATISTIK PUBLIK (agregat saja)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.statistik_publik()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_selesai_bulan_ini INT := 0;
  v_diproses INT := 0;
  v_total_tahun_ini INT := 0;
BEGIN
  SELECT count(*) INTO v_selesai_bulan_ini
  FROM public.surat_pengantar_rt004
  WHERE status = 'DISETUJUI'
    AND tanggal_pengajuan >= date_trunc('month', current_date)::DATE;

  SELECT count(*) INTO v_diproses
  FROM public.surat_pengantar_rt004
  WHERE status = 'PENDING';

  SELECT count(*) INTO v_total_tahun_ini
  FROM public.surat_pengantar_rt004
  WHERE tanggal_pengajuan >= date_trunc('year', current_date)::DATE;

  RETURN jsonb_build_object(
    'suratSelesaiBulanIni', v_selesai_bulan_ini,
    'suratDiproses',        v_diproses,
    'suratTahunIni',        v_total_tahun_ini
  );
END;
$$;

REVOKE ALL ON FUNCTION public.statistik_publik() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.statistik_publik() TO anon, authenticated;


-- =====================================================================
-- E. PENGUMUMAN LINGKUNGAN
-- ---------------------------------------------------------------------
-- Hanya baris dengan dipublikasikan = TRUE yang boleh dibaca publik, dan
-- itu pun lewat fungsi, bukan lewat akses tabel langsung.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pengumuman_rt004 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul VARCHAR(200) NOT NULL,
  isi TEXT NOT NULL,
  kategori VARCHAR(30) NOT NULL DEFAULT 'UMUM',
  dipublikasikan BOOLEAN NOT NULL DEFAULT FALSE,
  tanggal_mulai DATE NOT NULL DEFAULT current_date,
  tanggal_selesai DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dibuat_oleh UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.pengumuman_rt004 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pengumuman_rt004 FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pengumuman_rt004 TO authenticated;

DROP POLICY IF EXISTS "Pengurus aktif boleh baca pengumuman" ON public.pengumuman_rt004;
DROP POLICY IF EXISTS "Admin RT boleh tambah pengumuman" ON public.pengumuman_rt004;
DROP POLICY IF EXISTS "Admin RT boleh ubah pengumuman" ON public.pengumuman_rt004;
DROP POLICY IF EXISTS "Admin RT boleh hapus pengumuman" ON public.pengumuman_rt004;

CREATE POLICY "Pengurus aktif boleh baca pengumuman" ON public.pengumuman_rt004
  FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh tambah pengumuman" ON public.pengumuman_rt004
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_rt());
CREATE POLICY "Admin RT boleh ubah pengumuman" ON public.pengumuman_rt004
  FOR UPDATE TO authenticated USING (public.is_admin_rt()) WITH CHECK (public.is_admin_rt());
CREATE POLICY "Admin RT boleh hapus pengumuman" ON public.pengumuman_rt004
  FOR DELETE TO authenticated USING (public.is_admin_rt());

CREATE OR REPLACE FUNCTION public.pengumuman_publik()
RETURNS TABLE (
  id UUID,
  judul VARCHAR(200),
  isi TEXT,
  kategori VARCHAR(30),
  tanggal_mulai DATE,
  tanggal_selesai DATE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.judul, p.isi, p.kategori, p.tanggal_mulai, p.tanggal_selesai
  FROM public.pengumuman_rt004 p
  WHERE p.dipublikasikan = TRUE
    AND p.tanggal_mulai <= current_date
    AND (p.tanggal_selesai IS NULL OR p.tanggal_selesai >= current_date)
  ORDER BY p.tanggal_mulai DESC, p.created_at DESC
  LIMIT 6;
$$;

REVOKE ALL ON FUNCTION public.pengumuman_publik() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pengumuman_publik() TO anon, authenticated;


-- =====================================================================
-- F. PENGADUAN / LAPORAN WARGA
-- ---------------------------------------------------------------------
-- Warga mengirim lewat fungsi ber-pembatas laju; hanya pengurus yang
-- boleh membaca isinya. Tabel tidak pernah dibuka untuk anon.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pengaduan_rt004 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_tiket TEXT NOT NULL UNIQUE,
  kategori VARCHAR(30) NOT NULL,
  nama_pelapor VARCHAR(150) NOT NULL,
  kontak_pelapor VARCHAR(30) NOT NULL,
  alamat_kejadian VARCHAR(300) NOT NULL,
  isi_laporan TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'BARU',
  tanggapan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pengaduan_rt004 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pengaduan_rt004 FROM anon;
GRANT SELECT, UPDATE ON public.pengaduan_rt004 TO authenticated;

DROP POLICY IF EXISTS "Pengurus aktif boleh baca pengaduan" ON public.pengaduan_rt004;
DROP POLICY IF EXISTS "Pengurus aktif boleh tanggapi pengaduan" ON public.pengaduan_rt004;

CREATE POLICY "Pengurus aktif boleh baca pengaduan" ON public.pengaduan_rt004
  FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh tanggapi pengaduan" ON public.pengaduan_rt004
  FOR UPDATE TO authenticated USING (public.is_pengurus_aktif()) WITH CHECK (public.is_pengurus_aktif());

CREATE INDEX IF NOT EXISTS idx_pengaduan_rt004_kontak_waktu
  ON public.pengaduan_rt004 (kontak_pelapor, created_at);

CREATE OR REPLACE FUNCTION public.kirim_pengaduan(
  p_kategori TEXT,
  p_nama TEXT,
  p_kontak TEXT,
  p_alamat TEXT,
  p_isi TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed TEXT[] := ARRAY['KEAMANAN','KEBERSIHAN','INFRASTRUKTUR','SOSIAL','LAINNYA'];
  v_kategori TEXT := upper(trim(coalesce(p_kategori, 'LAINNYA')));
  v_kontak TEXT := left(trim(coalesce(p_kontak, '')), 30);
  v_tiket TEXT;
  v_jumlah INT;
BEGIN
  IF NOT (v_kategori = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Kategori laporan tidak valid';
  END IF;
  IF length(trim(coalesce(p_nama, ''))) < 3 THEN
    RAISE EXCEPTION 'Nama pelapor belum lengkap';
  END IF;
  IF v_kontak !~ '^[0-9+\-\s]{8,30}$' THEN
    RAISE EXCEPTION 'Nomor kontak tidak valid';
  END IF;
  IF length(trim(coalesce(p_alamat, ''))) < 5 THEN
    RAISE EXCEPTION 'Lokasi kejadian belum lengkap';
  END IF;
  IF length(trim(coalesce(p_isi, ''))) < 15 THEN
    RAISE EXCEPTION 'Uraian laporan terlalu singkat. Mohon jelaskan lebih rinci.';
  END IF;

  -- Pembatas laju: maksimum 3 laporan per nomor kontak per jam.
  SELECT count(*) INTO v_jumlah
  FROM public.pengaduan_rt004
  WHERE kontak_pelapor = v_kontak
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_jumlah >= 3 THEN
    RAISE EXCEPTION 'Terlalu banyak laporan dari nomor ini dalam satu jam. Mohon tunggu sebentar atau hubungi pengurus langsung.';
  END IF;

  v_tiket := 'ADU-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS');

  INSERT INTO public.pengaduan_rt004 (
    nomor_tiket, kategori, nama_pelapor, kontak_pelapor, alamat_kejadian, isi_laporan
  ) VALUES (
    v_tiket, v_kategori, left(trim(p_nama), 150), v_kontak,
    left(trim(p_alamat), 300), left(trim(p_isi), 2000)
  );

  RETURN v_tiket;
END;
$$;

REVOKE ALL ON FUNCTION public.kirim_pengaduan(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kirim_pengaduan(TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;


-- =====================================================================
-- G. Realtime untuk pengumuman & pengaduan agar dashboard pengurus
--    langsung memunculkan laporan baru.
-- =====================================================================
ALTER TABLE public.pengumuman_rt004 REPLICA IDENTITY FULL;
ALTER TABLE public.pengaduan_rt004 REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pengumuman_rt004'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pengumuman_rt004;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pengaduan_rt004'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pengaduan_rt004;
  END IF;
END $$;

-- Segarkan schema cache PostgREST, tanpa ini API masih membalas
-- "Could not find the function in the schema cache".
NOTIFY pgrst, 'reload schema';


-- =====================================================================
-- H. VERIFIKASI
--    Semua baris harus menghasilkan tersedia = true.
-- =====================================================================
SELECT 'konfigurasi_publik' AS objek,
       EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'konfigurasi_publik') AS tersedia
UNION ALL
SELECT 'cek_status_pengajuan',
       EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'cek_status_pengajuan')
UNION ALL
SELECT 'statistik_publik',
       EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'statistik_publik')
UNION ALL
SELECT 'pengumuman_publik',
       EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'pengumuman_publik')
UNION ALL
SELECT 'kirim_pengaduan',
       EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'kirim_pengaduan')
UNION ALL
SELECT 'tabel pengumuman_rt004',
       EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pengumuman_rt004')
UNION ALL
SELECT 'tabel pengaduan_rt004',
       EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pengaduan_rt004');
