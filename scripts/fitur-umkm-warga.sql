-- =====================================================================
-- FITUR: UMKM WARGA RT004 — mini-marketplace (Portal Warga Terpadu, Fase C2)
--
-- KONSEP: setiap warga login boleh membuat "lapak" (toko) berisi produk &
--   varian. Setelah diverifikasi pengurus, lapak tampil di etalase bersama
--   yang bisa dilihat SEMUA warga login. Pemesanan dilakukan langsung ke
--   penjual lewat WhatsApp (tidak ada transaksi di dalam aplikasi).
--
-- HAK AKSES (inti fitur):
--   - Pemilik (owner_uid = auth.uid()): kelola (tambah/ubah/hapus) lapak,
--     produk, & varian MILIKNYA sendiri. Tidak bisa menyentuh milik warga lain.
--   - Admin (is_admin_rt): kelola SEMUA + verifikasi/tolak lapak.
--   - Semua warga login (authenticated): MELIHAT lapak berstatus VERIFIED
--     beserta produk & variannya (etalase bersama). Lapak sendiri selalu
--     terlihat oleh pemiliknya walau belum VERIFIED.
--   - anon: TIDAK punya akses apa pun.
--
-- KEAMANAN: status verifikasi & kepemilikan dikunci oleh trigger
--   `umkm_guard()` — warga TIDAK bisa memverifikasi lapaknya sendiri
--   maupun mengklaim lapak orang lain; hanya admin yang boleh.
--
-- CARA PAKAI: Supabase Dashboard → SQL Editor → tempel semua → Run.
--   Idempoten. Blok verifikasi di akhir harus semua "OK".
--
-- PRASYARAT: scripts/setup-skema-utama.sql (is_pengurus_aktif, is_admin_rt).
-- =====================================================================

-- 1. Tabel lapak / toko UMKM
CREATE TABLE IF NOT EXISTS public.umkm_rt004 (
    id           TEXT        PRIMARY KEY DEFAULT 'UMK-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6)),
    owner_uid    UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    nama_usaha   TEXT        NOT NULL,
    kategori     TEXT        NOT NULL DEFAULT 'Lainnya',
    deskripsi    TEXT        NOT NULL DEFAULT '',
    foto_url     TEXT        NULL,
    kontak_wa    TEXT        NOT NULL DEFAULT '',
    alamat       TEXT        NOT NULL DEFAULT '',
    status       VARCHAR(10) NOT NULL DEFAULT 'PENDING',   -- PENDING | VERIFIED | DITOLAK
    catatan_admin TEXT       NULL,
    reviewed_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at  TIMESTAMPTZ NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel produk (milik satu lapak)
CREATE TABLE IF NOT EXISTS public.umkm_produk_rt004 (
    id          TEXT        PRIMARY KEY DEFAULT 'PRD-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6)),
    umkm_id     TEXT        NOT NULL REFERENCES public.umkm_rt004(id) ON DELETE CASCADE,
    nama_produk TEXT        NOT NULL,
    deskripsi   TEXT        NOT NULL DEFAULT '',
    harga       NUMERIC(12,2) NOT NULL DEFAULT 0,
    foto_url    TEXT        NULL,
    tersedia    BOOLEAN     NOT NULL DEFAULT true,
    urutan      INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabel varian / pilihan produk (opsional; produk tanpa varian = produk polos)
CREATE TABLE IF NOT EXISTS public.umkm_varian_rt004 (
    id          TEXT        PRIMARY KEY DEFAULT 'VRN-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6)),
    produk_id   TEXT        NOT NULL REFERENCES public.umkm_produk_rt004(id) ON DELETE CASCADE,
    nama_varian TEXT        NOT NULL,
    harga       NUMERIC(12,2) NOT NULL DEFAULT 0,
    tersedia    BOOLEAN     NOT NULL DEFAULT true,
    urutan      INT         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_umkm_owner   ON public.umkm_rt004 (owner_uid);
CREATE INDEX IF NOT EXISTS idx_umkm_status  ON public.umkm_rt004 (status);
CREATE INDEX IF NOT EXISTS idx_produk_umkm  ON public.umkm_produk_rt004 (umkm_id);
CREATE INDEX IF NOT EXISTS idx_varian_produk ON public.umkm_varian_rt004 (produk_id);

-- =====================================================================
-- TRIGGER PENGAMAN: kunci status verifikasi & kepemilikan
--   - Non-admin yang INSERT lapak: status dipaksa PENDING, review dikosongkan.
--   - Non-admin yang UPDATE lapak: dilarang mengubah status / reviewer / owner.
--   - Admin: bebas (jalur verifikasi).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.umkm_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin_rt() THEN
      NEW.status := 'PENDING';
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  NEW.updated_at := NOW();
  IF NOT public.is_admin_rt() THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.owner_uid IS DISTINCT FROM OLD.owner_uid THEN
      RAISE EXCEPTION 'Hanya pengurus yang dapat mengubah status verifikasi atau kepemilikan UMKM.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_umkm_guard ON public.umkm_rt004;
CREATE TRIGGER trg_umkm_guard
    BEFORE INSERT OR UPDATE ON public.umkm_rt004
    FOR EACH ROW EXECUTE FUNCTION public.umkm_guard();

-- =====================================================================
-- KEAMANAN: ROW LEVEL SECURITY (RLS)
-- =====================================================================
ALTER TABLE public.umkm_rt004        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.umkm_produk_rt004 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.umkm_varian_rt004 ENABLE ROW LEVEL SECURITY;

-- Bersihkan policy lama (aman dijalankan berulang)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('umkm_rt004', 'umkm_produk_rt004', 'umkm_varian_rt004')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

REVOKE ALL ON public.umkm_rt004        FROM anon;
REVOKE ALL ON public.umkm_produk_rt004 FROM anon;
REVOKE ALL ON public.umkm_varian_rt004 FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.umkm_rt004        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.umkm_produk_rt004 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.umkm_varian_rt004 TO authenticated;

-- ── Lapak (umkm_rt004) ─────────────────────────────────────────────────────
-- Baca: lapak VERIFIED (etalase) + lapak sendiri + semua (bila admin).
CREATE POLICY "Baca lapak UMKM"
    ON public.umkm_rt004 FOR SELECT
    TO authenticated
    USING (status = 'VERIFIED' OR owner_uid = auth.uid() OR public.is_admin_rt());

-- Tambah: hanya untuk lapak milik sendiri (atau admin). Status dikunci trigger.
CREATE POLICY "Tambah lapak UMKM"
    ON public.umkm_rt004 FOR INSERT
    TO authenticated
    WITH CHECK (owner_uid = auth.uid() OR public.is_admin_rt());

-- Ubah: pemilik atau admin.
CREATE POLICY "Ubah lapak UMKM"
    ON public.umkm_rt004 FOR UPDATE
    TO authenticated
    USING (owner_uid = auth.uid() OR public.is_admin_rt())
    WITH CHECK (owner_uid = auth.uid() OR public.is_admin_rt());

-- Hapus: pemilik atau admin.
CREATE POLICY "Hapus lapak UMKM"
    ON public.umkm_rt004 FOR DELETE
    TO authenticated
    USING (owner_uid = auth.uid() OR public.is_admin_rt());

-- ── Produk (umkm_produk_rt004) ──────────────────────────────────────────────
-- Baca: produk dari lapak VERIFIED / lapak sendiri / admin.
CREATE POLICY "Baca produk UMKM"
    ON public.umkm_produk_rt004 FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.umkm_rt004 t
        WHERE t.id = umkm_id
          AND (t.status = 'VERIFIED' OR t.owner_uid = auth.uid() OR public.is_admin_rt())
    ));

-- Tulis (tambah/ubah/hapus): hanya pemilik lapak induk atau admin.
CREATE POLICY "Tambah produk UMKM"
    ON public.umkm_produk_rt004 FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.umkm_rt004 t
        WHERE t.id = umkm_id AND (t.owner_uid = auth.uid() OR public.is_admin_rt())
    ));

CREATE POLICY "Ubah produk UMKM"
    ON public.umkm_produk_rt004 FOR UPDATE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.umkm_rt004 t
        WHERE t.id = umkm_id AND (t.owner_uid = auth.uid() OR public.is_admin_rt())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.umkm_rt004 t
        WHERE t.id = umkm_id AND (t.owner_uid = auth.uid() OR public.is_admin_rt())
    ));

CREATE POLICY "Hapus produk UMKM"
    ON public.umkm_produk_rt004 FOR DELETE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.umkm_rt004 t
        WHERE t.id = umkm_id AND (t.owner_uid = auth.uid() OR public.is_admin_rt())
    ));

-- ── Varian (umkm_varian_rt004) ──────────────────────────────────────────────
-- Baca: varian dari produk pada lapak VERIFIED / lapak sendiri / admin.
CREATE POLICY "Baca varian UMKM"
    ON public.umkm_varian_rt004 FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.umkm_produk_rt004 p
        JOIN public.umkm_rt004 t ON t.id = p.umkm_id
        WHERE p.id = produk_id
          AND (t.status = 'VERIFIED' OR t.owner_uid = auth.uid() OR public.is_admin_rt())
    ));

-- Tulis: hanya pemilik lapak induk atau admin.
CREATE POLICY "Tambah varian UMKM"
    ON public.umkm_varian_rt004 FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.umkm_produk_rt004 p
        JOIN public.umkm_rt004 t ON t.id = p.umkm_id
        WHERE p.id = produk_id AND (t.owner_uid = auth.uid() OR public.is_admin_rt())
    ));

CREATE POLICY "Ubah varian UMKM"
    ON public.umkm_varian_rt004 FOR UPDATE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.umkm_produk_rt004 p
        JOIN public.umkm_rt004 t ON t.id = p.umkm_id
        WHERE p.id = produk_id AND (t.owner_uid = auth.uid() OR public.is_admin_rt())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.umkm_produk_rt004 p
        JOIN public.umkm_rt004 t ON t.id = p.umkm_id
        WHERE p.id = produk_id AND (t.owner_uid = auth.uid() OR public.is_admin_rt())
    ));

CREATE POLICY "Hapus varian UMKM"
    ON public.umkm_varian_rt004 FOR DELETE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.umkm_produk_rt004 p
        JOIN public.umkm_rt004 t ON t.id = p.umkm_id
        WHERE p.id = produk_id AND (t.owner_uid = auth.uid() OR public.is_admin_rt())
    ));

-- =====================================================================
-- REALTIME: antrean verifikasi admin auto-refresh saat ada lapak baru
-- =====================================================================
ALTER TABLE public.umkm_rt004 REPLICA IDENTITY FULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'umkm_rt004'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.umkm_rt004;
    END IF;
END $$;

-- =====================================================================
-- STORAGE BUCKET: foto lapak & produk UMKM (max 2MB per file)
--   Upload/hapus oleh warga login (dibatasi ke bucket ini); baca publik.
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'umkm-foto',
    'umkm-foto',
    true,
    2097152,
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
          AND policyname='Warga login upload foto UMKM'
    ) THEN
        CREATE POLICY "Warga login upload foto UMKM"
            ON storage.objects FOR INSERT
            TO authenticated
            WITH CHECK (bucket_id = 'umkm-foto');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
          AND policyname='Warga login hapus foto UMKM'
    ) THEN
        CREATE POLICY "Warga login hapus foto UMKM"
            ON storage.objects FOR DELETE
            TO authenticated
            USING (bucket_id = 'umkm-foto');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
          AND policyname='Foto UMKM bisa dibaca publik'
    ) THEN
        CREATE POLICY "Foto UMKM bisa dibaca publik"
            ON storage.objects FOR SELECT
            TO anon, authenticated
            USING (bucket_id = 'umkm-foto');
    END IF;
END $$;

-- =====================================================================
-- VERIFIKASI (semua baris harus "OK")
-- =====================================================================
SELECT 'Tabel umkm_rt004' AS pemeriksaan,
    CASE WHEN to_regclass('public.umkm_rt004') IS NOT NULL THEN 'OK - ada' ELSE 'GAGAL' END AS status
UNION ALL
SELECT 'Tabel umkm_produk_rt004',
    CASE WHEN to_regclass('public.umkm_produk_rt004') IS NOT NULL THEN 'OK - ada' ELSE 'GAGAL' END
UNION ALL
SELECT 'Tabel umkm_varian_rt004',
    CASE WHEN to_regclass('public.umkm_varian_rt004') IS NOT NULL THEN 'OK - ada' ELSE 'GAGAL' END
UNION ALL
SELECT 'RLS aktif (3 tabel)',
    CASE WHEN (SELECT bool_and(relrowsecurity) FROM pg_class
              WHERE oid IN ('public.umkm_rt004'::regclass,'public.umkm_produk_rt004'::regclass,'public.umkm_varian_rt004'::regclass))
         THEN 'OK - aktif' ELSE 'BAHAYA - ada RLS mati' END
UNION ALL
SELECT 'anon TIDAK bisa baca lapak',
    CASE WHEN NOT has_table_privilege('anon','public.umkm_rt004','SELECT') THEN 'OK - anon diblokir' ELSE 'BAHAYA' END
UNION ALL
SELECT 'Trigger pengaman umkm_guard',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_umkm_guard') THEN 'OK - aktif' ELSE 'GAGAL' END
UNION ALL
SELECT 'Jumlah policy UMKM (harus 12)',
    CASE WHEN (SELECT count(*) FROM pg_policies WHERE schemaname='public'
              AND tablename IN ('umkm_rt004','umkm_produk_rt004','umkm_varian_rt004')) = 12
         THEN 'OK - 12 policy' ELSE 'PERIKSA - jumlah policy bukan 12' END
UNION ALL
SELECT 'Bucket umkm-foto',
    CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id='umkm-foto') THEN 'OK - ada' ELSE 'GAGAL' END;

NOTIFY pgrst, 'reload schema';
