-- =====================================================================
-- E-RT04 - CEK KOLOM YANG KURANG (READ-ONLY / AMAN)
-- ---------------------------------------------------------------------
-- DIHASILKAN OTOMATIS oleh scripts/_generate-cek-kolom.ps1 dari
-- scripts/setup-skema-utama.sql. Jangan diedit manual.
--
-- Skrip ini HANYA MEMBACA. Tujuannya mendeteksi schema drift:
-- CREATE TABLE IF NOT EXISTS tidak menambah kolom pada tabel yang sudah
-- ada, jadi database yang dibuat dari skema versi lama bisa kekurangan
-- kolom tanpa memunculkan error saat SQL dijalankan. Kekurangan itu
-- baru terasa nanti sebagai gagal insert/update dari aplikasi.
--
-- Cara pakai: copy seluruh isi file ini ke Supabase SQL Editor, Run.
--
-- Cara baca hasil:
--   status = 'KOLOM KURANG'  -> perlu ALTER TABLE ADD COLUMN
--   status = 'TABEL BELUM ADA' -> cukup jalankan setup-skema-utama.sql
--   0 rows                   -> skema sudah lengkap, tidak perlu apa pun
--
-- Jumlah kolom yang diharapkan per tabel:
--   kartu_keluarga_rt004 : 17 kolom
--   warga_rt004 : 25 kolom
--   surat_pengantar_rt004 : 25 kolom
--   mutasi_penduduk_rt004 : 13 kolom
--   pengurus_profil : 11 kolom
--   konfigurasi_rt004 : 4 kolom
--   ews_laporan_rt004 : 10 kolom
--   ews_fcm_tokens : 5 kolom
-- =====================================================================

WITH diharapkan (nama_tabel, nama_kolom) AS (
    VALUES
    ('kartu_keluarga_rt004', 'id'),
    ('kartu_keluarga_rt004', 'nomor_kk'),
    ('kartu_keluarga_rt004', 'kepala_keluarga_nama'),
    ('kartu_keluarga_rt004', 'kepala_keluarga_nik'),
    ('kartu_keluarga_rt004', 'alamat'),
    ('kartu_keluarga_rt004', 'rt'),
    ('kartu_keluarga_rt004', 'rw'),
    ('kartu_keluarga_rt004', 'kelurahan'),
    ('kartu_keluarga_rt004', 'kecamatan'),
    ('kartu_keluarga_rt004', 'kabupaten_kota'),
    ('kartu_keluarga_rt004', 'provinsi'),
    ('kartu_keluarga_rt004', 'kode_pos'),
    ('kartu_keluarga_rt004', 'status_domisili'),
    ('kartu_keluarga_rt004', 'blok_rumah'),
    ('kartu_keluarga_rt004', 'tanggal_terbit'),
    ('kartu_keluarga_rt004', 'tanggal_update'),
    ('kartu_keluarga_rt004', 'catatan'),
    ('warga_rt004', 'id'),
    ('warga_rt004', 'nik'),
    ('warga_rt004', 'nomor_kk'),
    ('warga_rt004', 'nama'),
    ('warga_rt004', 'jenis_kelamin'),
    ('warga_rt004', 'tempat_lahir'),
    ('warga_rt004', 'tanggal_lahir'),
    ('warga_rt004', 'agama'),
    ('warga_rt004', 'pendidikan'),
    ('warga_rt004', 'pekerjaan'),
    ('warga_rt004', 'status_perkawinan'),
    ('warga_rt004', 'status_hubungan_kk'),
    ('warga_rt004', 'kewarganegaraan'),
    ('warga_rt004', 'golongan_darah'),
    ('warga_rt004', 'nomor_hp'),
    ('warga_rt004', 'email'),
    ('warga_rt004', 'status_tinggal'),
    ('warga_rt004', 'is_lansia'),
    ('warga_rt004', 'is_balita'),
    ('warga_rt004', 'is_yatim'),
    ('warga_rt004', 'is_disabilitas'),
    ('warga_rt004', 'status_bansos'),
    ('warga_rt004', 'keterangan_bansos'),
    ('warga_rt004', 'tanggal_input'),
    ('warga_rt004', 'catatan'),
    ('surat_pengantar_rt004', 'id'),
    ('surat_pengantar_rt004', 'nomor_surat'),
    ('surat_pengantar_rt004', 'jenis_surat'),
    ('surat_pengantar_rt004', 'judul_surat'),
    ('surat_pengantar_rt004', 'nik_pemohon'),
    ('surat_pengantar_rt004', 'nama_pemohon'),
    ('surat_pengantar_rt004', 'nomor_kk_pemohon'),
    ('surat_pengantar_rt004', 'tempat_tgl_lahir_pemohon'),
    ('surat_pengantar_rt004', 'jenis_kelamin_pemohon'),
    ('surat_pengantar_rt004', 'agama_pemohon'),
    ('surat_pengantar_rt004', 'pekerjaan_pemohon'),
    ('surat_pengantar_rt004', 'status_kawin_pemohon'),
    ('surat_pengantar_rt004', 'telepon_pemohon'),
    ('surat_pengantar_rt004', 'alamat_pemohon'),
    ('surat_pengantar_rt004', 'keperluan'),
    ('surat_pengantar_rt004', 'keterangan_lain'),
    ('surat_pengantar_rt004', 'tanggal_pengajuan'),
    ('surat_pengantar_rt004', 'tanggal_disetujui'),
    ('surat_pengantar_rt004', 'status'),
    ('surat_pengantar_rt004', 'alasan_penolakan'),
    ('surat_pengantar_rt004', 'nama_pejabat_ttd'),
    ('surat_pengantar_rt004', 'jabatan_ttd'),
    ('surat_pengantar_rt004', 'kode_verifikasi_qr'),
    ('surat_pengantar_rt004', 'dibuat_oleh'),
    ('surat_pengantar_rt004', 'created_at'),
    ('mutasi_penduduk_rt004', 'id'),
    ('mutasi_penduduk_rt004', 'tanggal'),
    ('mutasi_penduduk_rt004', 'jenis_mutasi'),
    ('mutasi_penduduk_rt004', 'nik'),
    ('mutasi_penduduk_rt004', 'nama_warga'),
    ('mutasi_penduduk_rt004', 'nomor_kk'),
    ('mutasi_penduduk_rt004', 'alamat_asal'),
    ('mutasi_penduduk_rt004', 'alamat_tujuan'),
    ('mutasi_penduduk_rt004', 'alasan'),
    ('mutasi_penduduk_rt004', 'no_surat_keterangan'),
    ('mutasi_penduduk_rt004', 'petugas'),
    ('mutasi_penduduk_rt004', 'catatan'),
    ('mutasi_penduduk_rt004', 'created_at'),
    ('pengurus_profil', 'id'),
    ('pengurus_profil', 'username'),
    ('pengurus_profil', 'nama_lengkap'),
    ('pengurus_profil', 'role'),
    ('pengurus_profil', 'role_label'),
    ('pengurus_profil', 'nomor_hp'),
    ('pengurus_profil', 'email'),
    ('pengurus_profil', 'jabatan_khusus'),
    ('pengurus_profil', 'is_active'),
    ('pengurus_profil', 'terakhir_login'),
    ('pengurus_profil', 'created_at'),
    ('konfigurasi_rt004', 'id'),
    ('konfigurasi_rt004', 'config_data'),
    ('konfigurasi_rt004', 'updated_at'),
    ('konfigurasi_rt004', 'updated_by'),
    ('ews_laporan_rt004', 'id'),
    ('ews_laporan_rt004', 'jenis_kejadian'),
    ('ews_laporan_rt004', 'deskripsi'),
    ('ews_laporan_rt004', 'nama_pelapor'),
    ('ews_laporan_rt004', 'alamat'),
    ('ews_laporan_rt004', 'foto_url'),
    ('ews_laporan_rt004', 'status'),
    ('ews_laporan_rt004', 'created_at'),
    ('ews_laporan_rt004', 'updated_at'),
    ('ews_laporan_rt004', 'updated_by'),
    ('ews_fcm_tokens', 'id'),
    ('ews_fcm_tokens', 'token'),
    ('ews_fcm_tokens', 'device_info'),
    ('ews_fcm_tokens', 'created_at'),
    ('ews_fcm_tokens', 'updated_at')
),
tabel_ada AS (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
),
kolom_ada AS (
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
)
SELECT
    d.nama_tabel,
    d.nama_kolom,
    CASE
        WHEN t.table_name IS NULL THEN 'TABEL BELUM ADA - jalankan setup-skema-utama.sql'
        ELSE 'KOLOM KURANG - perlu ALTER TABLE ADD COLUMN'
    END AS status
FROM diharapkan d
LEFT JOIN tabel_ada t ON t.table_name  = d.nama_tabel
LEFT JOIN kolom_ada k ON k.table_name  = d.nama_tabel
                     AND k.column_name = d.nama_kolom
WHERE k.column_name IS NULL
ORDER BY d.nama_tabel, d.nama_kolom;
