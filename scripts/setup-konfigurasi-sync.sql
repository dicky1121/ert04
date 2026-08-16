-- =====================================================================
-- SIP RT 004 RW 007 - Konfigurasi bersama (template & kop surat)
-- ---------------------------------------------------------------------
-- Jalankan skrip ini di Supabase SQL Editor SATU KALI saja.
-- Tujuan: membuat tabel public.konfigurasi_rt004 agar Template Surat
-- Pengantar, kop surat, logo, tanda tangan, dan tipografi otomatis
-- tersinkron ke SELURUH role pengurus dan SEMUA perangkat baru tanpa
-- perlu menekan tombol apa pun di menu Integrasi.
--
-- Skrip aman dijalankan berulang kali (idempotent).
-- Prasyarat: scripts/setup-pengurus.sql sudah dijalankan (fungsi
-- public.is_pengurus_aktif() dan public.is_admin_rt() harus tersedia).
-- =====================================================================

-- 0. Pastikan fungsi penjaga RLS sudah ada agar tabel tidak pernah
--    terbuka tanpa kontrol akses.
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
END $$;

-- 1. Satu baris konfigurasi global dipakai bersama oleh semua pengurus.
--    Logo & tanda tangan disimpan sebagai data URL di dalam JSONB agar
--    tampil identik di perangkat lain tanpa bucket Storage tambahan.
CREATE TABLE IF NOT EXISTS public.konfigurasi_rt004 (
  id TEXT PRIMARY KEY DEFAULT 'global',
  config_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.konfigurasi_rt004
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.konfigurasi_rt004
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Kunci akses: anon (form publik) tidak boleh menyentuh tabel ini.
ALTER TABLE public.konfigurasi_rt004 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.konfigurasi_rt004 FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.konfigurasi_rt004 TO authenticated;

DROP POLICY IF EXISTS "Pengurus aktif boleh baca konfigurasi" ON public.konfigurasi_rt004;
DROP POLICY IF EXISTS "Admin RT boleh tambah konfigurasi" ON public.konfigurasi_rt004;
DROP POLICY IF EXISTS "Admin RT boleh ubah konfigurasi" ON public.konfigurasi_rt004;

-- Semua role pengurus aktif boleh MEMBACA (agar template ikut terpakai
-- saat mereka mencetak surat), tetapi hanya admin penuh boleh MENGUBAH.
CREATE POLICY "Pengurus aktif boleh baca konfigurasi" ON public.konfigurasi_rt004
  FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh tambah konfigurasi" ON public.konfigurasi_rt004
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_rt() AND id = 'global');
CREATE POLICY "Admin RT boleh ubah konfigurasi" ON public.konfigurasi_rt004
  FOR UPDATE TO authenticated USING (public.is_admin_rt()) WITH CHECK (public.is_admin_rt() AND id = 'global');

-- 3. Jejak audit ringan: siapa dan kapan terakhir mengubah template.
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

DROP TRIGGER IF EXISTS trg_set_sync_metadata ON public.konfigurasi_rt004;
CREATE TRIGGER trg_set_sync_metadata
  BEFORE INSERT OR UPDATE ON public.konfigurasi_rt004
  FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata();

-- 4. Baris awal supaya perangkat baru selalu menemukan konfigurasi.
INSERT INTO public.konfigurasi_rt004 (id, config_data)
VALUES ('global', '{}'::JSONB)
ON CONFLICT (id) DO NOTHING;

-- 5. Aktifkan realtime agar perubahan template langsung terkirim ke
--    perangkat lain yang sedang membuka aplikasi.
ALTER TABLE public.konfigurasi_rt004 REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'konfigurasi_rt004'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.konfigurasi_rt004;
  END IF;
END $$;

-- 6. Segarkan schema cache PostgREST. Tanpa langkah ini API masih
--    membalas "Could not find the table in the schema cache".
NOTIFY pgrst, 'reload schema';

-- 7. Verifikasi. Harus mengembalikan satu baris id = 'global'
--    dan status realtime = true.
SELECT
  k.id,
  k.updated_at,
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'konfigurasi_rt004'
  ) AS realtime_aktif
FROM public.konfigurasi_rt004 k
WHERE k.id = 'global';
