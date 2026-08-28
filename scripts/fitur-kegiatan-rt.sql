-- =====================================================================
-- FITUR: KEGIATAN RT — jadwal kegiatan & acara lingkungan
--   (bagian dari Portal Warga Terpadu, Fase C1)
--
-- ALUR: pengurus menambah kegiatan lewat panel admin → kegiatan yang
--   ditandai "dipublikasikan" muncul di tab Kegiatan dashboard warga.
--   Warga HANYA BISA MEMBACA (read-only) kegiatan yang dipublikasikan.
--
-- KEAMANAN:
--   - anon (tanpa login) TIDAK punya akses apa pun.
--   - authenticated (warga login) hanya SELECT baris dipublikasikan = true.
--   - pengurus aktif (is_pengurus_aktif) SELECT semua + INSERT/UPDATE/DELETE.
--
-- CARA PAKAI: Supabase Dashboard → SQL Editor → tempel semua → Run.
--   Idempoten (aman dijalankan berulang). Blok verifikasi di akhir harus
--   semua "OK".
--
-- PRASYARAT: scripts/setup-skema-utama.sql (menyediakan is_pengurus_aktif()).
-- =====================================================================

-- 1. Tabel kegiatan RT
CREATE TABLE IF NOT EXISTS public.kegiatan_rt004 (
    id             TEXT        PRIMARY KEY DEFAULT 'KEG-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6)),
    judul          TEXT        NOT NULL,
    deskripsi      TEXT        NOT NULL DEFAULT '',
    tanggal        DATE        NOT NULL,
    waktu          TEXT        NOT NULL DEFAULT '',   -- jam / free text, mis. "08:00 WIB"
    lokasi         TEXT        NOT NULL DEFAULT '',
    foto_url       TEXT        NULL,
    dipublikasikan BOOLEAN     NOT NULL DEFAULT true,
    dibuat_oleh    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kegiatan_tanggal        ON public.kegiatan_rt004 (tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_kegiatan_dipublikasikan ON public.kegiatan_rt004 (dipublikasikan);

-- =====================================================================
-- KEAMANAN: ROW LEVEL SECURITY (RLS)
-- =====================================================================
ALTER TABLE public.kegiatan_rt004 ENABLE ROW LEVEL SECURITY;

-- Bersihkan policy lama jika ada (agar aman dijalankan berulang)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'kegiatan_rt004'
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            pol.policyname, pol.schemaname, pol.tablename
        );
    END LOOP;
END $$;

-- Hak akses tabel: anon TIDAK punya akses, warga login boleh baca (difilter policy)
REVOKE ALL                            ON public.kegiatan_rt004 FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.kegiatan_rt004 TO authenticated;

-- Policy baca: warga login melihat kegiatan dipublikasikan; pengurus melihat semua
CREATE POLICY "Warga & pengurus baca kegiatan"
    ON public.kegiatan_rt004
    FOR SELECT
    TO authenticated
    USING (dipublikasikan = true OR public.is_pengurus_aktif());

-- Policy tulis: hanya pengurus aktif yang boleh menambah / ubah / hapus
CREATE POLICY "Pengurus tambah kegiatan"
    ON public.kegiatan_rt004
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_pengurus_aktif());

CREATE POLICY "Pengurus ubah kegiatan"
    ON public.kegiatan_rt004
    FOR UPDATE
    TO authenticated
    USING (public.is_pengurus_aktif())
    WITH CHECK (public.is_pengurus_aktif());

CREATE POLICY "Pengurus hapus kegiatan"
    ON public.kegiatan_rt004
    FOR DELETE
    TO authenticated
    USING (public.is_pengurus_aktif());

-- =====================================================================
-- TRIGGER: update updated_at otomatis
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_kegiatan_rt004_updated_at()
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

DROP TRIGGER IF EXISTS trg_kegiatan_updated_at ON public.kegiatan_rt004;
CREATE TRIGGER trg_kegiatan_updated_at
    BEFORE UPDATE ON public.kegiatan_rt004
    FOR EACH ROW EXECUTE FUNCTION public.set_kegiatan_rt004_updated_at();

-- =====================================================================
-- REALTIME: aktifkan publikasi agar admin dashboard auto-refresh
-- =====================================================================
ALTER TABLE public.kegiatan_rt004 REPLICA IDENTITY FULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'kegiatan_rt004'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.kegiatan_rt004;
    END IF;
END $$;

-- =====================================================================
-- STORAGE BUCKET: untuk foto / poster kegiatan (max 2MB per file)
--   Upload hanya oleh pengurus; baca publik (poster tampil di dashboard).
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'kegiatan-foto',
    'kegiatan-foto',
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
          AND policyname = 'Pengurus upload foto kegiatan'
    ) THEN
        CREATE POLICY "Pengurus upload foto kegiatan"
            ON storage.objects FOR INSERT
            TO authenticated
            WITH CHECK (bucket_id = 'kegiatan-foto' AND public.is_pengurus_aktif());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Pengurus hapus foto kegiatan'
    ) THEN
        CREATE POLICY "Pengurus hapus foto kegiatan"
            ON storage.objects FOR DELETE
            TO authenticated
            USING (bucket_id = 'kegiatan-foto' AND public.is_pengurus_aktif());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Foto kegiatan bisa dibaca publik'
    ) THEN
        CREATE POLICY "Foto kegiatan bisa dibaca publik"
            ON storage.objects FOR SELECT
            TO anon, authenticated
            USING (bucket_id = 'kegiatan-foto');
    END IF;
END $$;

-- =====================================================================
-- VERIFIKASI (semua baris harus "OK")
-- =====================================================================
SELECT 'Tabel kegiatan_rt004' AS pemeriksaan,
    CASE WHEN to_regclass('public.kegiatan_rt004') IS NOT NULL
         THEN 'OK - ada' ELSE 'GAGAL - belum terbentuk' END AS status
UNION ALL
SELECT 'RLS aktif',
    CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.kegiatan_rt004'::regclass)
         THEN 'OK - aktif' ELSE 'BAHAYA - RLS mati' END
UNION ALL
SELECT 'anon TIDAK bisa baca kegiatan',
    CASE WHEN NOT has_table_privilege('anon', 'public.kegiatan_rt004', 'SELECT')
         THEN 'OK - anon diblokir' ELSE 'BAHAYA - anon bisa baca' END
UNION ALL
SELECT 'authenticated bisa baca kegiatan',
    CASE WHEN has_table_privilege('authenticated', 'public.kegiatan_rt004', 'SELECT')
         THEN 'OK' ELSE 'GAGAL - grant select kurang' END
UNION ALL
SELECT 'Jumlah policy kegiatan (harus 4)',
    CASE WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kegiatan_rt004') = 4
         THEN 'OK - 4 policy' ELSE 'PERIKSA - jumlah policy bukan 4' END
UNION ALL
SELECT 'Bucket kegiatan-foto',
    CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'kegiatan-foto')
         THEN 'OK - ada' ELSE 'GAGAL - bucket belum dibuat' END;

-- Muat ulang schema cache PostgREST agar tabel langsung dikenali API
NOTIFY pgrst, 'reload schema';
