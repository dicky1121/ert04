-- =====================================================================
-- FITUR: IURAN / TAGIHAN WARGA RT004 — tagihan per-warga + verifikasi bukti
--   (bagian dari Portal Warga Terpadu)
--
-- ALUR:
--   1. Pengurus keuangan membuat tagihan (satuan / generate massal per periode)
--      untuk tiap warga → status BELUM_LUNAS.
--   2. Warga membuka tagihannya, transfer sesuai info pembayaran RT, lalu
--      MENGUNGGAH BUKTI → status berpindah ke MENUNGGU_VERIFIKASI.
--   3. Pengurus meninjau bukti → SETUJUI (LUNAS) atau TOLAK (DITOLAK + alasan).
--   4. Bila ditolak, warga bisa mengunggah bukti ulang.
--
-- KEAMANAN (inti fitur):
--   - anon TIDAK punya akses apa pun.
--   - Warga hanya melihat & menyentuh TAGIHAN MILIKNYA (di-scope
--     public.my_warga_id() → warga_akun.warga_id).
--   - Warga TIDAK BISA menandai lunas sendiri / mengubah nominal: dikunci
--     trigger `iuran_guard()`. Warga hanya boleh melampirkan bukti dan
--     berpindah ke MENUNGGU_VERIFIKASI pada baris miliknya.
--   - Hanya PENGURUS KEUANGAN (public.is_pengurus_keuangan): ADMIN_KETUA_RT,
--     ADMIN_SEKRETARIS, ADMIN_SISTEM, BENDAHARA) yang boleh membuat,
--     mengubah nominal, menghapus, & memverifikasi.
--   - Bukti transfer disimpan di bucket PRIVAT `bukti-bayar` (bukan publik) —
--     hanya bisa dilihat lewat signed URL oleh pengguna login.
--
-- CARA PAKAI: Supabase Dashboard → SQL Editor → tempel semua → Run.
--   Idempoten (aman dijalankan berulang). Blok verifikasi di akhir harus
--   semua "OK".
--
-- PRASYARAT:
--   - scripts/setup-skema-utama.sql (pengurus_profil, is_admin_rt).
--   - scripts/fitur-keuangan-rt.sql (menyediakan public.is_pengurus_keuangan()).
--   - scripts/fitur-akun-warga.sql (menyediakan warga_akun untuk my_warga_id()).
-- =====================================================================

-- =====================================================================
-- HELPER: resolusi warga_id (warga_rt004.id) dari user login.
--   SECURITY DEFINER + search_path tetap agar aman dipakai di policy dan
--   tidak memicu rekursi RLS saat membaca warga_akun. Hanya akun AKTIF.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.my_warga_id()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT warga_id
  FROM public.warga_akun
  WHERE id = auth.uid()
    AND status = 'AKTIF'
  LIMIT 1;
$$;

-- 1. Tabel tagihan iuran
CREATE TABLE IF NOT EXISTS public.iuran_rt004 (
    id           TEXT          PRIMARY KEY DEFAULT 'IUR-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6)),
    warga_id     TEXT          NOT NULL REFERENCES public.warga_rt004(id) ON DELETE CASCADE,
    judul        TEXT          NOT NULL DEFAULT 'Iuran Kas RT',
    periode      TEXT          NOT NULL,                                   -- 'YYYY-MM'
    jumlah       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (jumlah >= 0),
    jatuh_tempo  DATE          NULL,
    status       VARCHAR(20)   NOT NULL DEFAULT 'BELUM_LUNAS'
                    CHECK (status IN ('BELUM_LUNAS', 'MENUNGGU_VERIFIKASI', 'LUNAS', 'DITOLAK')),
    bukti_path   TEXT          NULL,                                       -- path objek di bucket privat 'bukti-bayar'
    dibayar_at   TIMESTAMPTZ   NULL,                                       -- saat warga mengirim bukti
    verified_by  UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at  TIMESTAMPTZ   NULL,
    catatan      TEXT          NULL,                                       -- alasan tolak / catatan pengurus
    dibuat_oleh  UUID          DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    -- cegah tagihan ganda untuk warga+periode+judul yang sama (dipakai generate massal)
    CONSTRAINT uq_iuran_warga_periode_judul UNIQUE (warga_id, periode, judul)
);

CREATE INDEX IF NOT EXISTS idx_iuran_warga   ON public.iuran_rt004 (warga_id);
CREATE INDEX IF NOT EXISTS idx_iuran_status  ON public.iuran_rt004 (status);
CREATE INDEX IF NOT EXISTS idx_iuran_periode ON public.iuran_rt004 (periode);

-- 2. Tabel setelan iuran (baris tunggal id=1) — info pembayaran RT + default.
CREATE TABLE IF NOT EXISTS public.pengaturan_iuran_rt004 (
    id              INT           PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    info_pembayaran TEXT          NOT NULL DEFAULT '',                     -- mis. 'BCA 1234567890 a.n. Kas RT 004 · DANA 0812xxxx'
    nominal_default NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (nominal_default >= 0),
    judul_default   TEXT          NOT NULL DEFAULT 'Iuran Kas RT',
    updated_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

INSERT INTO public.pengaturan_iuran_rt004 (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- TRIGGER PENGAMAN: kunci nominal, kepemilikan, & status verifikasi.
--   - INSERT (hanya pengurus via RLS): stamp verifikasi bila dibuat langsung
--     sebagai LUNAS/DITOLAK.
--   - UPDATE pengurus: bebas; stamp verified_by/at saat status → LUNAS/DITOLAK.
--   - UPDATE warga (non-pengurus): hanya boleh set bukti_path + berpindah
--     (BELUM_LUNAS|DITOLAK) → MENUNGGU_VERIFIKASI. Dilarang ubah nominal,
--     kepemilikan, periode, catatan, atau menandai LUNAS.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.iuran_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.is_pengurus_keuangan() AND NEW.status IN ('LUNAS', 'DITOLAK') THEN
      NEW.verified_by := auth.uid();
      NEW.verified_at := NOW();
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  NEW.updated_at := NOW();

  IF public.is_pengurus_keuangan() THEN
    -- Jalur verifikasi pengurus: stamp saat status masuk LUNAS/DITOLAK.
    IF NEW.status IN ('LUNAS', 'DITOLAK') AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.verified_by := auth.uid();
      NEW.verified_at := NOW();
    END IF;
    RETURN NEW;
  END IF;

  -- Non-pengurus (warga pemilik) — batasi kolom yang boleh diubah.
  IF NEW.jumlah       IS DISTINCT FROM OLD.jumlah
     OR NEW.warga_id    IS DISTINCT FROM OLD.warga_id
     OR NEW.judul       IS DISTINCT FROM OLD.judul
     OR NEW.periode     IS DISTINCT FROM OLD.periode
     OR NEW.jatuh_tempo IS DISTINCT FROM OLD.jatuh_tempo
     OR NEW.catatan     IS DISTINCT FROM OLD.catatan
     OR NEW.dibuat_oleh IS DISTINCT FROM OLD.dibuat_oleh THEN
    RAISE EXCEPTION 'Warga tidak boleh mengubah detail tagihan.';
  END IF;

  -- Kunci kolom verifikasi ke nilai lama (warga tak boleh menyentuhnya).
  NEW.verified_by := OLD.verified_by;
  NEW.verified_at := OLD.verified_at;

  -- Transisi status yang diizinkan: (BELUM_LUNAS|DITOLAK) → MENUNGGU_VERIFIKASI.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'MENUNGGU_VERIFIKASI' AND OLD.status IN ('BELUM_LUNAS', 'DITOLAK') THEN
      NEW.dibayar_at := NOW();
    ELSE
      RAISE EXCEPTION 'Warga hanya dapat mengirim bukti untuk diverifikasi, bukan mengubah status pembayaran.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_iuran_guard ON public.iuran_rt004;
CREATE TRIGGER trg_iuran_guard
    BEFORE INSERT OR UPDATE ON public.iuran_rt004
    FOR EACH ROW EXECUTE FUNCTION public.iuran_guard();

-- Trigger kecil untuk stamp updated_at/by pada setelan.
CREATE OR REPLACE FUNCTION public.set_pengaturan_iuran_fields()
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

DROP TRIGGER IF EXISTS trg_pengaturan_iuran_fields ON public.pengaturan_iuran_rt004;
CREATE TRIGGER trg_pengaturan_iuran_fields
    BEFORE INSERT OR UPDATE ON public.pengaturan_iuran_rt004
    FOR EACH ROW EXECUTE FUNCTION public.set_pengaturan_iuran_fields();

-- =====================================================================
-- KEAMANAN: ROW LEVEL SECURITY (RLS)
-- =====================================================================
ALTER TABLE public.iuran_rt004            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengaturan_iuran_rt004 ENABLE ROW LEVEL SECURITY;

-- Bersihkan policy lama (aman dijalankan berulang)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('iuran_rt004', 'pengaturan_iuran_rt004')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

REVOKE ALL ON public.iuran_rt004            FROM anon;
REVOKE ALL ON public.pengaturan_iuran_rt004 FROM anon;
-- Warga perlu UPDATE (lampirkan bukti); INSERT/DELETE dibatasi policy ke pengurus.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iuran_rt004            TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.pengaturan_iuran_rt004 TO authenticated;

-- ── Tagihan (iuran_rt004) ───────────────────────────────────────────────────
-- Baca: warga baca tagihan sendiri; pengurus baca semua.
CREATE POLICY "Baca tagihan iuran"
    ON public.iuran_rt004 FOR SELECT
    TO authenticated
    USING (warga_id = public.my_warga_id() OR public.is_pengurus_keuangan());

-- Tambah: hanya pengurus keuangan.
CREATE POLICY "Pengurus tambah tagihan"
    ON public.iuran_rt004 FOR INSERT
    TO authenticated
    WITH CHECK (public.is_pengurus_keuangan());

-- Ubah: warga (baris sendiri, dibatasi trigger) atau pengurus (bebas).
CREATE POLICY "Ubah tagihan iuran"
    ON public.iuran_rt004 FOR UPDATE
    TO authenticated
    USING (warga_id = public.my_warga_id() OR public.is_pengurus_keuangan())
    WITH CHECK (warga_id = public.my_warga_id() OR public.is_pengurus_keuangan());

-- Hapus: hanya pengurus keuangan.
CREATE POLICY "Pengurus hapus tagihan"
    ON public.iuran_rt004 FOR DELETE
    TO authenticated
    USING (public.is_pengurus_keuangan());

-- ── Setelan iuran (pengaturan_iuran_rt004) ──────────────────────────────────
-- Baca: semua warga login (butuh info pembayaran saat mau bayar).
CREATE POLICY "Baca setelan iuran"
    ON public.pengaturan_iuran_rt004 FOR SELECT
    TO authenticated
    USING (true);

-- Tulis: hanya pengurus keuangan.
CREATE POLICY "Pengurus tambah setelan iuran"
    ON public.pengaturan_iuran_rt004 FOR INSERT
    TO authenticated
    WITH CHECK (public.is_pengurus_keuangan());

CREATE POLICY "Pengurus ubah setelan iuran"
    ON public.pengaturan_iuran_rt004 FOR UPDATE
    TO authenticated
    USING (public.is_pengurus_keuangan())
    WITH CHECK (public.is_pengurus_keuangan());

-- =====================================================================
-- REALTIME: dashboard admin & warga auto-refresh saat tagihan berubah
-- =====================================================================
ALTER TABLE public.iuran_rt004 REPLICA IDENTITY FULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'iuran_rt004'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.iuran_rt004;
    END IF;
END $$;

-- =====================================================================
-- STORAGE BUCKET: bukti transfer (PRIVAT, max 2MB per file)
--   Bucket privat → tidak world-readable via URL; render via signed URL.
--   Upload/baca/hapus hanya untuk pengguna login (warga & pengurus).
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'bukti-bayar',
    'bukti-bayar',
    false,
    2097152,
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
          AND policyname='Login upload bukti bayar'
    ) THEN
        CREATE POLICY "Login upload bukti bayar"
            ON storage.objects FOR INSERT
            TO authenticated
            WITH CHECK (bucket_id = 'bukti-bayar');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
          AND policyname='Login baca bukti bayar'
    ) THEN
        CREATE POLICY "Login baca bukti bayar"
            ON storage.objects FOR SELECT
            TO authenticated
            USING (bucket_id = 'bukti-bayar');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
          AND policyname='Login hapus bukti bayar'
    ) THEN
        CREATE POLICY "Login hapus bukti bayar"
            ON storage.objects FOR DELETE
            TO authenticated
            USING (bucket_id = 'bukti-bayar');
    END IF;
END $$;

-- =====================================================================
-- VERIFIKASI (semua baris harus "OK")
-- =====================================================================
SELECT 'Fungsi my_warga_id()' AS pemeriksaan,
    CASE WHEN to_regprocedure('public.my_warga_id()') IS NOT NULL
         THEN 'OK - ada' ELSE 'GAGAL - belum terbentuk' END AS status
UNION ALL
SELECT 'Fungsi is_pengurus_keuangan() (prasyarat)',
    CASE WHEN to_regprocedure('public.is_pengurus_keuangan()') IS NOT NULL
         THEN 'OK - ada' ELSE 'GAGAL - jalankan fitur-keuangan-rt.sql dulu' END
UNION ALL
SELECT 'Tabel iuran_rt004',
    CASE WHEN to_regclass('public.iuran_rt004') IS NOT NULL THEN 'OK - ada' ELSE 'GAGAL' END
UNION ALL
SELECT 'Tabel pengaturan_iuran_rt004',
    CASE WHEN to_regclass('public.pengaturan_iuran_rt004') IS NOT NULL THEN 'OK - ada' ELSE 'GAGAL' END
UNION ALL
SELECT 'RLS aktif (2 tabel)',
    CASE WHEN (SELECT bool_and(relrowsecurity) FROM pg_class
              WHERE oid IN ('public.iuran_rt004'::regclass, 'public.pengaturan_iuran_rt004'::regclass))
         THEN 'OK - aktif' ELSE 'BAHAYA - ada RLS mati' END
UNION ALL
SELECT 'anon TIDAK bisa baca tagihan',
    CASE WHEN NOT has_table_privilege('anon', 'public.iuran_rt004', 'SELECT')
         THEN 'OK - anon diblokir' ELSE 'BAHAYA - anon bisa baca' END
UNION ALL
SELECT 'Trigger pengaman iuran_guard',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_iuran_guard')
         THEN 'OK - aktif' ELSE 'GAGAL' END
UNION ALL
SELECT 'Jumlah policy iuran_rt004 (harus 4)',
    CASE WHEN (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='iuran_rt004') = 4
         THEN 'OK - 4 policy' ELSE 'PERIKSA - jumlah policy bukan 4' END
UNION ALL
SELECT 'Jumlah policy pengaturan_iuran (harus 3)',
    CASE WHEN (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='pengaturan_iuran_rt004') = 3
         THEN 'OK - 3 policy' ELSE 'PERIKSA - jumlah policy bukan 3' END
UNION ALL
SELECT 'Setelan iuran ter-seed (id=1)',
    CASE WHEN EXISTS (SELECT 1 FROM public.pengaturan_iuran_rt004 WHERE id = 1)
         THEN 'OK - ada' ELSE 'GAGAL - baris default hilang' END
UNION ALL
SELECT 'Bucket privat bukti-bayar',
    CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id='bukti-bayar' AND public = false)
         THEN 'OK - ada & privat' ELSE 'PERIKSA - bucket hilang / tidak privat' END;

-- Muat ulang schema cache PostgREST agar tabel langsung dikenali API
NOTIFY pgrst, 'reload schema';
