-- ============================================================
-- Tabel Pengajuan Perubahan KK dari Portal Warga
-- Jalankan sekali di Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS kk_pengajuan_rt004 (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  warga_id                  UUID        NOT NULL REFERENCES warga_rt004(id) ON DELETE CASCADE,
  nama_pengaju              TEXT,
  jenis                     TEXT        NOT NULL CHECK (jenis IN ('UBAH_NOMOR_KK', 'HAPUS_ANGGOTA')),
  nomor_kk_baru             TEXT        NULL,
  anggota_target_id         UUID        NULL REFERENCES warga_rt004(id) ON DELETE SET NULL,
  nama_anggota_target       TEXT        NULL,
  alasan                    TEXT        NOT NULL,
  status                    TEXT        NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DISETUJUI', 'DITOLAK')),
  ditambahkan_oleh_warga_id UUID        NULL,   -- auth.uid warga yang mengajukan (untuk validasi kepemilikan)
  diajukan_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direview_at               TIMESTAMPTZ NULL,
  direview_oleh             TEXT        NULL,
  catatan_admin             TEXT        NULL
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_kk_pengajuan_warga_id ON kk_pengajuan_rt004(warga_id);
CREATE INDEX IF NOT EXISTS idx_kk_pengajuan_status   ON kk_pengajuan_rt004(status);

-- RLS
ALTER TABLE kk_pengajuan_rt004 ENABLE ROW LEVEL SECURITY;

-- Warga bisa insert pengajuan sendiri
CREATE POLICY "Warga bisa ajukan perubahan KK"
  ON kk_pengajuan_rt004 FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM warga_akun
      WHERE id = auth.uid()
        AND warga_id = kk_pengajuan_rt004.warga_id
        AND status = 'AKTIF'
    )
  );

-- Warga bisa lihat pengajuannya sendiri
CREATE POLICY "Warga bisa lihat pengajuan KK miliknya"
  ON kk_pengajuan_rt004 FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM warga_akun
      WHERE id = auth.uid()
        AND warga_id = kk_pengajuan_rt004.warga_id
    )
    OR public.is_pengurus_aktif()
  );

-- Pengurus aktif bisa update status
CREATE POLICY "Pengurus aktif bisa review pengajuan KK"
  ON kk_pengajuan_rt004 FOR UPDATE
  TO authenticated
  USING (public.is_pengurus_aktif())
  WITH CHECK (public.is_pengurus_aktif());

-- Pengurus aktif bisa select semua
CREATE POLICY "Pengurus aktif bisa baca semua pengajuan KK"
  ON kk_pengajuan_rt004 FOR SELECT
  TO authenticated
  USING (public.is_pengurus_aktif());
