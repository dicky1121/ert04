-- =====================================================================
-- SIP RT 004 RW 007 - metadata dan publication untuk sinkronisasi realtime
-- Jalankan setelah skema utama dari menu Integrasi selesai dibuat.
-- Skrip aman dijalankan berulang kali.
-- =====================================================================

-- Satu baris konfigurasi global dipakai bersama oleh seluruh role admin.
-- Logo disimpan di dalam JSONB sebagai data URL agar tampil identik di
-- perangkat lain tanpa memerlukan bucket Storage tambahan.
CREATE TABLE IF NOT EXISTS public.konfigurasi_rt004 (
  id TEXT PRIMARY KEY DEFAULT 'global',
  config_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.konfigurasi_rt004 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.konfigurasi_rt004 FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.konfigurasi_rt004 TO authenticated;

DROP POLICY IF EXISTS "Pengurus aktif boleh baca konfigurasi" ON public.konfigurasi_rt004;
DROP POLICY IF EXISTS "Admin RT boleh tambah konfigurasi" ON public.konfigurasi_rt004;
DROP POLICY IF EXISTS "Admin RT boleh ubah konfigurasi" ON public.konfigurasi_rt004;

CREATE POLICY "Pengurus aktif boleh baca konfigurasi" ON public.konfigurasi_rt004
  FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh tambah konfigurasi" ON public.konfigurasi_rt004
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_rt() AND id = 'global');
CREATE POLICY "Admin RT boleh ubah konfigurasi" ON public.konfigurasi_rt004
  FOR UPDATE TO authenticated USING (public.is_admin_rt()) WITH CHECK (public.is_admin_rt() AND id = 'global');

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
  END LOOP;
END $$;

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
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END $$;

-- Verifikasi: hasil harus menampilkan lima tabel.
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN (
    'kartu_keluarga_rt004',
    'warga_rt004',
    'surat_pengantar_rt004',
    'mutasi_penduduk_rt004',
    'konfigurasi_rt004'
  )
ORDER BY tablename;