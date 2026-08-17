-- =====================================================================
-- SETUP EWS (EARLY WARNING SYSTEM) RT 004 RW 007 JATIMULYA
-- Jalankan script ini di Supabase SQL Editor untuk mengaktifkan
-- fitur EWS pada aplikasi Android SIP RT 004.
-- =====================================================================

-- 1. Tabel Laporan EWS
--    Menyimpan semua laporan kejadian darurat dari warga.
--    Anon (portal warga tanpa login) boleh INSERT.
--    Pengurus aktif boleh SELECT dan UPDATE status.
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

-- 2. Tabel FCM Tokens
--    Menyimpan token push notification tiap device Android.
--    Token di-UPSERT saat app dibuka, agar selalu up-to-date.
CREATE TABLE IF NOT EXISTS ews_fcm_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    token       TEXT        UNIQUE NOT NULL,
    device_info TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- KEAMANAN: ROW LEVEL SECURITY (RLS)
-- =====================================================================
ALTER TABLE ews_laporan_rt004 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ews_fcm_tokens    ENABLE ROW LEVEL SECURITY;

-- Bersihkan policy lama jika ada (agar aman dijalankan berulang)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('ews_laporan_rt004', 'ews_fcm_tokens')
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            pol.policyname, pol.schemaname, pol.tablename
        );
    END LOOP;
END $$;

-- Hak akses tabel laporan EWS
GRANT INSERT                  ON ews_laporan_rt004 TO anon;
GRANT SELECT, INSERT, UPDATE  ON ews_laporan_rt004 TO authenticated;

-- Hak akses tabel FCM tokens
GRANT INSERT, UPDATE          ON ews_fcm_tokens TO anon;
GRANT SELECT, INSERT, UPDATE  ON ews_fcm_tokens TO authenticated;

-- Policy: siapapun (termasuk anon) boleh kirim laporan
CREATE POLICY "Siapapun boleh kirim laporan EWS"
    ON ews_laporan_rt004
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy: pengurus aktif bisa baca semua laporan
CREATE POLICY "Pengurus aktif boleh baca laporan EWS"
    ON ews_laporan_rt004
    FOR SELECT
    TO authenticated
    USING (public.is_pengurus_aktif());

-- Policy: pengurus aktif bisa update status laporan
CREATE POLICY "Pengurus aktif boleh update status EWS"
    ON ews_laporan_rt004
    FOR UPDATE
    TO authenticated
    USING (public.is_pengurus_aktif())
    WITH CHECK (public.is_pengurus_aktif());

-- Policy FCM tokens: siapapun boleh daftar/update token
CREATE POLICY "Siapapun boleh daftar FCM token"
    ON ews_fcm_tokens
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Siapapun boleh update FCM token"
    ON ews_fcm_tokens
    FOR UPDATE
    TO anon, authenticated
    USING (true);

-- Policy: pengurus aktif bisa baca semua token (untuk broadcast notif)
CREATE POLICY "Pengurus aktif boleh baca FCM tokens"
    ON ews_fcm_tokens
    FOR SELECT
    TO authenticated
    USING (public.is_pengurus_aktif());

-- =====================================================================
-- TRIGGER: update updated_at otomatis
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_ews_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ews_laporan_updated_at ON ews_laporan_rt004;
CREATE TRIGGER trg_ews_laporan_updated_at
    BEFORE UPDATE ON ews_laporan_rt004
    FOR EACH ROW EXECUTE FUNCTION public.set_ews_updated_at();

DROP TRIGGER IF EXISTS trg_ews_token_updated_at ON ews_fcm_tokens;
CREATE TRIGGER trg_ews_token_updated_at
    BEFORE UPDATE ON ews_fcm_tokens
    FOR EACH ROW EXECUTE FUNCTION public.set_ews_updated_at();

-- =====================================================================
-- REALTIME: aktifkan publikasi agar admin dashboard auto-refresh
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'ews_laporan_rt004'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ews_laporan_rt004;
    END IF;
END $$;

-- =====================================================================
-- STORAGE BUCKET: untuk foto laporan EWS (max 2MB per file)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ews-foto',
    'ews-foto',
    true,
    2097152,
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Siapapun boleh upload foto EWS'
    ) THEN
        CREATE POLICY "Siapapun boleh upload foto EWS"
            ON storage.objects FOR INSERT
            TO anon, authenticated
            WITH CHECK (bucket_id = 'ews-foto');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Foto EWS bisa dibaca publik'
    ) THEN
        CREATE POLICY "Foto EWS bisa dibaca publik"
            ON storage.objects FOR SELECT
            TO anon, authenticated
            USING (bucket_id = 'ews-foto');
    END IF;
END $$;

-- =====================================================================
-- SELESAI — Langkah selanjutnya:
-- 1. Deploy Edge Function 'kirim-notif-ews'
--    (lihat supabase/functions/kirim-notif-ews/)
-- 2. Setup Database Webhook di Supabase Dashboard:
--    Table: ews_laporan_rt004 | Event: INSERT
--    URL: https://<project-ref>.supabase.co/functions/v1/kirim-notif-ews
-- 3. Build APK dan install ke device warga
-- =====================================================================
