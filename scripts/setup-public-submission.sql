-- SIP RT 004 - endpoint terbatas untuk pengajuan surat oleh warga.
-- Jalankan setelah skema utama. Tabel tetap tidak dapat dibaca oleh anon.

ALTER TABLE public.surat_pengantar_rt004
  ADD COLUMN IF NOT EXISTS telepon_pemohon VARCHAR(30);

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
BEGIN
  IF p_jenis_surat IS NULL OR NOT (upper(trim(p_jenis_surat)) = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Jenis surat tidak valid';
  END IF;
  IF p_nik !~ '^[0-9]{16}$' OR p_nomor_kk !~ '^[0-9]{16}$' THEN
    RAISE EXCEPTION 'NIK dan nomor KK harus terdiri dari 16 digit';
  END IF;
  IF length(trim(p_nama)) < 3 OR length(trim(p_alamat)) < 10 OR length(trim(p_keperluan)) < 5 THEN
    RAISE EXCEPTION 'Nama, alamat, atau keperluan belum lengkap';
  END IF;
  IF p_jenis_kelamin NOT IN ('L', 'P') THEN
    RAISE EXCEPTION 'Jenis kelamin tidak valid';
  END IF;

  INSERT INTO public.surat_pengantar_rt004 (
    id, nomor_surat, jenis_surat, judul_surat, nik_pemohon, nama_pemohon,
    nomor_kk_pemohon, tempat_tgl_lahir_pemohon, jenis_kelamin_pemohon,
    agama_pemohon, pekerjaan_pemohon, status_kawin_pemohon, telepon_pemohon,
    alamat_pemohon, keperluan, keterangan_lain, tanggal_pengajuan, status,
    nama_pejabat_ttd, jabatan_ttd, kode_verifikasi_qr, dibuat_oleh
  ) VALUES (
    v_id, v_reference, upper(trim(p_jenis_surat)), 'PENGAJUAN SURAT WARGA', trim(p_nik),
    left(trim(p_nama), 150), trim(p_nomor_kk), left(trim(p_tempat_tgl_lahir), 150),
    p_jenis_kelamin, left(trim(p_agama), 30), left(trim(p_pekerjaan), 100),
    left(trim(p_status_kawin), 30), left(trim(p_telepon), 30), left(trim(p_alamat), 500),
    left(trim(p_keperluan), 500), left(coalesce(trim(p_keterangan), ''), 500),
    current_date, 'PENDING', '', '', v_reference, 'WARGA'
  );

  RETURN v_reference;
END;
$$;

REVOKE ALL ON FUNCTION public.ajukan_surat_warga(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ajukan_surat_warga(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;