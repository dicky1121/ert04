-- =====================================================================
-- FITUR: KEUANGAN RT — ringkasan kas RT (transparansi warga)
--   (bagian dari Portal Warga Terpadu, Fase C3)
--
-- ALUR: pengurus keuangan mencatat transaksi MASUK/KELUAR lewat panel
--   admin → semua warga login melihat ringkasan (saldo, total masuk/keluar,
--   kas per bulan) + daftar transaksi di tab Keuangan dashboard warga.
--   Warga HANYA BISA MEMBACA (read-only) — transparansi kas RT.
--
-- KEAMANAN:
--   - anon (tanpa login) TIDAK punya akses apa pun.
--   - authenticated (warga login + pengurus) boleh SELECT semua (transparansi).
--   - hanya PENGURUS KEUANGAN (is_pengurus_keuangan) yang boleh
--     INSERT/UPDATE/DELETE: role ∈ ADMIN_KETUA_RT, ADMIN_SEKRETARIS,
--     ADMIN_SISTEM, BENDAHARA.
--
-- CARA PAKAI: Supabase Dashboard → SQL Editor → tempel semua → Run.
--   Idempoten (aman dijalankan berulang). Blok verifikasi di akhir harus
--   semua "OK".
--
-- PRASYARAT: scripts/setup-skema-utama.sql (menyediakan pengurus_profil).
-- =====================================================================

-- =====================================================================
-- HELPER: cek apakah user login adalah pengurus yang berhak atas keuangan.
--   Meniru pola is_admin_rt() namun menambahkan peran BENDAHARA.
--   SECURITY DEFINER + search_path tetap agar aman dipakai di dalam policy
--   dan tidak menimbulkan rekursi RLS saat membaca pengurus_profil.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_pengurus_keuangan()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pengurus_profil p
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
      AND p.role IN ('ADMIN_KETUA_RT', 'ADMIN_SEKRETARIS', 'ADMIN_SISTEM', 'BENDAHARA')
  );
$$;

-- 1. Tabel transaksi keuangan RT
CREATE TABLE IF NOT EXISTS public.keuangan_rt004 (
    id          TEXT         PRIMARY KEY DEFAULT 'KAS-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6)),
    tanggal     DATE         NOT NULL,
    jenis       VARCHAR(6)   NOT NULL DEFAULT 'MASUK' CHECK (jenis IN ('MASUK', 'KELUAR')),
    kategori    TEXT         NOT NULL DEFAULT 'Lainnya',
    jumlah      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (jumlah >= 0),
    keterangan  TEXT         NOT NULL DEFAULT '',
    bulan_kas   TEXT         NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM'),  -- 'YYYY-MM', diisi trigger dari tanggal
    dibuat_oleh UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_keuangan_tanggal   ON public.keuangan_rt004 (tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_keuangan_bulan_kas ON public.keuangan_rt004 (bulan_kas);
CREATE INDEX IF NOT EXISTS idx_keuangan_jenis     ON public.keuangan_rt004 (jenis);

-- =====================================================================
-- KEAMANAN: ROW LEVEL SECURITY (RLS)
-- =====================================================================
ALTER TABLE public.keuangan_rt004 ENABLE ROW LEVEL SECURITY;

-- Bersihkan policy lama jika ada (agar aman dijalankan berulang)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'keuangan_rt004'
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            pol.policyname, pol.schemaname, pol.tablename
        );
    END LOOP;
END $$;

-- Hak akses tabel: anon TIDAK punya akses, authenticated boleh (difilter policy)
REVOKE ALL                            ON public.keuangan_rt004 FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.keuangan_rt004 TO authenticated;

-- Policy baca: semua warga login + pengurus melihat seluruh transaksi (transparansi)
CREATE POLICY "Semua login baca keuangan"
    ON public.keuangan_rt004
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy tulis: hanya pengurus keuangan yang boleh menambah / ubah / hapus
CREATE POLICY "Pengurus keuangan tambah transaksi"
    ON public.keuangan_rt004
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_pengurus_keuangan());

CREATE POLICY "Pengurus keuangan ubah transaksi"
    ON public.keuangan_rt004
    FOR UPDATE
    TO authenticated
    USING (public.is_pengurus_keuangan())
    WITH CHECK (public.is_pengurus_keuangan());

CREATE POLICY "Pengurus keuangan hapus transaksi"
    ON public.keuangan_rt004
    FOR DELETE
    TO authenticated
    USING (public.is_pengurus_keuangan());

-- =====================================================================
-- TRIGGER: sinkronkan bulan_kas dari tanggal + update updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_keuangan_rt004_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.bulan_kas := to_char(NEW.tanggal, 'YYYY-MM');
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_keuangan_fields ON public.keuangan_rt004;
CREATE TRIGGER trg_keuangan_fields
    BEFORE INSERT OR UPDATE ON public.keuangan_rt004
    FOR EACH ROW EXECUTE FUNCTION public.set_keuangan_rt004_fields();

-- =====================================================================
-- REALTIME: aktifkan publikasi agar admin dashboard auto-refresh
-- =====================================================================
ALTER TABLE public.keuangan_rt004 REPLICA IDENTITY FULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'keuangan_rt004'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.keuangan_rt004;
    END IF;
END $$;

-- =====================================================================
-- VERIFIKASI (semua baris harus "OK")
-- =====================================================================
SELECT 'Fungsi is_pengurus_keuangan()' AS pemeriksaan,
    CASE WHEN to_regprocedure('public.is_pengurus_keuangan()') IS NOT NULL
         THEN 'OK - ada' ELSE 'GAGAL - belum terbentuk' END AS status
UNION ALL
SELECT 'Tabel keuangan_rt004',
    CASE WHEN to_regclass('public.keuangan_rt004') IS NOT NULL
         THEN 'OK - ada' ELSE 'GAGAL - belum terbentuk' END
UNION ALL
SELECT 'RLS aktif',
    CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.keuangan_rt004'::regclass)
         THEN 'OK - aktif' ELSE 'BAHAYA - RLS mati' END
UNION ALL
SELECT 'anon TIDAK bisa baca keuangan',
    CASE WHEN NOT has_table_privilege('anon', 'public.keuangan_rt004', 'SELECT')
         THEN 'OK - anon diblokir' ELSE 'BAHAYA - anon bisa baca' END
UNION ALL
SELECT 'authenticated bisa baca keuangan',
    CASE WHEN has_table_privilege('authenticated', 'public.keuangan_rt004', 'SELECT')
         THEN 'OK' ELSE 'GAGAL - grant select kurang' END
UNION ALL
SELECT 'Jumlah policy keuangan (harus 4)',
    CASE WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'keuangan_rt004') = 4
         THEN 'OK - 4 policy' ELSE 'PERIKSA - jumlah policy bukan 4' END;

-- Muat ulang schema cache PostgREST agar tabel langsung dikenali API
NOTIFY pgrst, 'reload schema';
