-- =====================================================================
-- FITUR: AKUN WARGA (login NIK + PIN 6 angka) — fondasi Portal Warga Terpadu
--
-- Menumpang pada alur pendaftaran self-service yang sudah ada
-- (scripts/fitur-pendaftaran-warga.sql):
--   * Warga mendaftar lewat Edge Function `daftar-akun-warga` (service-role).
--     Edge Function membuat auth user (email sintetis <nik>@warga.rt004.id,
--     password = PIN 6 angka), lalu menaruh 1 baris di `warga_akun` (PENDING)
--     dan 1 baris pengajuan di `warga_submissions_rt004` (akun_user_id terisi).
--   * Pengurus meninjau di dashboard (UI pengajuan yang sudah ada). Saat
--     `setujui_pendaftaran_warga` dipanggil, bila pengajuan berasal dari
--     pendaftaran akun (akun_user_id NOT NULL), akun otomatis di-AKTIF-kan dan
--     ditautkan ke baris warga_rt004. `tolak_pendaftaran_warga` -> akun DITOLAK.
--   * Warga login lewat NIK + PIN; aplikasi mengecek status akun harus 'AKTIF'.
--
-- KEAMANAN:
--   * anon TIDAK punya akses tabel warga_akun. Pembuatan baris dilakukan oleh
--     Edge Function (service-role), bukan klien.
--   * Warga hanya bisa SELECT baris akun miliknya sendiri (id = auth.uid()).
--   * Pengurus aktif bisa SELECT/UPDATE semua akun (untuk tinjau/kelola).
--   * PIN di-hash oleh Supabase Auth; tidak pernah disimpan di tabel ini.
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> tempel -> Run. Idempoten.
--
-- PRASYARAT (jalankan lebih dulu bila belum):
--   1. scripts/setup-skema-utama.sql       (is_pengurus_aktif, is_admin_rt, warga_rt004)
--   2. scripts/fitur-pendaftaran-warga.sql  (warga_submissions_rt004 + RPC ACC)
--   3. Supabase Auth: minimum password length = 6 (agar PIN 6 angka diterima).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabel akun warga (1 baris per auth user warga)
-- ---------------------------------------------------------------------
create table if not exists public.warga_akun (
    id             uuid        primary key references auth.users(id) on delete cascade,
    nik            varchar(16) not null unique,
    warga_id       text        references public.warga_rt004(id),  -- diisi saat di-ACC
    nama           text,
    nomor_hp       text,
    status         varchar(10) not null default 'PENDING',  -- PENDING | AKTIF | DITOLAK | NONAKTIF
    submission_id  uuid,                                     -- pengajuan pemicu aktivasi
    gagal_login    int         not null default 0,           -- penghitung anti brute-force (opsional)
    dikunci_sampai timestamptz,                              -- kunci sementara (opsional)
    dibuat_at      timestamptz not null default now(),
    diaktifkan_at  timestamptz,
    terakhir_login timestamptz
);

create index if not exists idx_warga_akun_nik    on public.warga_akun (nik);
create index if not exists idx_warga_akun_status on public.warga_akun (status);


-- ---------------------------------------------------------------------
-- 2. Fungsi bantu: cek apakah user login adalah WARGA berstatus AKTIF.
--    SECURITY DEFINER + search_path tetap (pola sama is_pengurus_aktif).
-- ---------------------------------------------------------------------
create or replace function public.is_warga_aktif()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.warga_akun a
        where a.id = auth.uid() and a.status = 'AKTIF'
    );
$$;


-- ---------------------------------------------------------------------
-- 3. RLS: warga baca baris sendiri; pengurus aktif baca/ubah semua.
--    INSERT/DELETE hanya lewat service-role (Edge Function) — tidak dibuka.
-- ---------------------------------------------------------------------
alter table public.warga_akun enable row level security;

revoke all on public.warga_akun from anon;
grant  select on public.warga_akun to authenticated;

drop policy if exists "Warga baca akun sendiri"        on public.warga_akun;
drop policy if exists "Pengurus baca semua akun warga" on public.warga_akun;
drop policy if exists "Pengurus ubah akun warga"       on public.warga_akun;

create policy "Warga baca akun sendiri"
    on public.warga_akun for select
    to authenticated using (id = auth.uid());

create policy "Pengurus baca semua akun warga"
    on public.warga_akun for select
    to authenticated using (public.is_pengurus_aktif());

create policy "Pengurus ubah akun warga"
    on public.warga_akun for update
    to authenticated using (public.is_pengurus_aktif())
    with check (public.is_pengurus_aktif());


-- ---------------------------------------------------------------------
-- 4. Tautkan pengajuan ke akun warga (untuk aktivasi otomatis saat ACC).
-- ---------------------------------------------------------------------
alter table public.warga_submissions_rt004
    add column if not exists akun_user_id uuid;


-- ---------------------------------------------------------------------
-- 5. Perluas RPC persetujuan: setelah upsert warga_rt004, aktifkan akun.
--    (Sama persis dengan versi di fitur-pendaftaran-warga.sql, hanya
--    ditambah blok aktivasi warga_akun di bagian akhir.)
-- ---------------------------------------------------------------------
create or replace function public.setujui_pendaftaran_warga(
    p_submission_id uuid,
    p_fields        jsonb default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v          public.warga_submissions_rt004%rowtype;
    v_warga_id text;
    v_umur     int;
    v_lansia   boolean;
    v_balita   boolean;
begin
    if not public.is_pengurus_aktif() then
        raise exception 'Akses ditolak. Hanya pengurus aktif yang dapat menyetujui.';
    end if;

    select * into v from public.warga_submissions_rt004 where id = p_submission_id;
    if not found then
        raise exception 'Pengajuan tidak ditemukan.';
    end if;
    if v.status <> 'PENDING' then
        raise exception 'Pengajuan ini sudah diproses (status: %).', v.status;
    end if;

    v_umur   := case when v.tanggal_lahir is not null
                     then date_part('year', age(v.tanggal_lahir))::int end;
    v_lansia := coalesce(v_umur >= 60, false);
    v_balita := coalesce(v_umur <= 5, false);

    select id into v_warga_id from public.warga_rt004 where nik = v.nik limit 1;

    if v_warga_id is null then
        v_warga_id := 'w-' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text;
        insert into public.warga_rt004 (
            id, nik, nomor_kk, nama, jenis_kelamin, tempat_lahir, tanggal_lahir,
            agama, pekerjaan, status_perkawinan, status_hubungan_kk, golongan_darah,
            nomor_hp, email, status_tinggal, is_lansia, is_balita, is_yatim,
            is_disabilitas, status_bansos, keterangan_bansos, catatan, tanggal_input
        ) values (
            v_warga_id, v.nik, v.nomor_kk, v.nama, v.jenis_kelamin, v.tempat_lahir, v.tanggal_lahir,
            v.agama, v.pekerjaan, v.status_perkawinan, v.status_hubungan_kk, v.golongan_darah,
            v.nomor_hp, v.email, v.status_tinggal, v_lansia, v_balita, v.is_yatim,
            v.is_disabilitas, v.status_bansos, v.keterangan_bansos, v.catatan, current_date
        );
    else
        update public.warga_rt004 w set
            nomor_kk           = case when (p_fields is null or p_fields ? 'nomor_kk')           then v.nomor_kk           else w.nomor_kk end,
            nama               = case when (p_fields is null or p_fields ? 'nama')               then v.nama               else w.nama end,
            jenis_kelamin      = case when (p_fields is null or p_fields ? 'jenis_kelamin')      then v.jenis_kelamin      else w.jenis_kelamin end,
            tempat_lahir       = case when (p_fields is null or p_fields ? 'tempat_lahir')       then v.tempat_lahir       else w.tempat_lahir end,
            tanggal_lahir      = case when (p_fields is null or p_fields ? 'tanggal_lahir')      then v.tanggal_lahir      else w.tanggal_lahir end,
            agama              = case when (p_fields is null or p_fields ? 'agama')              then v.agama              else w.agama end,
            pekerjaan          = case when (p_fields is null or p_fields ? 'pekerjaan')          then v.pekerjaan          else w.pekerjaan end,
            status_perkawinan  = case when (p_fields is null or p_fields ? 'status_perkawinan')  then v.status_perkawinan  else w.status_perkawinan end,
            status_hubungan_kk = case when (p_fields is null or p_fields ? 'status_hubungan_kk') then v.status_hubungan_kk else w.status_hubungan_kk end,
            golongan_darah     = case when (p_fields is null or p_fields ? 'golongan_darah')     then v.golongan_darah     else w.golongan_darah end,
            nomor_hp           = case when (p_fields is null or p_fields ? 'nomor_hp')           then v.nomor_hp           else w.nomor_hp end,
            email              = case when (p_fields is null or p_fields ? 'email')              then v.email              else w.email end,
            status_tinggal     = case when (p_fields is null or p_fields ? 'status_tinggal')     then v.status_tinggal     else w.status_tinggal end,
            is_yatim           = case when (p_fields is null or p_fields ? 'is_yatim')           then v.is_yatim           else w.is_yatim end,
            is_disabilitas     = case when (p_fields is null or p_fields ? 'is_disabilitas')     then v.is_disabilitas     else w.is_disabilitas end,
            status_bansos      = case when (p_fields is null or p_fields ? 'status_bansos')      then v.status_bansos      else w.status_bansos end,
            keterangan_bansos  = case when (p_fields is null or p_fields ? 'keterangan_bansos')  then v.keterangan_bansos  else w.keterangan_bansos end,
            catatan            = case when (p_fields is null or p_fields ? 'catatan')            then v.catatan            else w.catatan end,
            is_lansia          = case when (p_fields is null or p_fields ? 'tanggal_lahir')      then v_lansia             else w.is_lansia end,
            is_balita          = case when (p_fields is null or p_fields ? 'tanggal_lahir')      then v_balita             else w.is_balita end
        where w.id = v_warga_id;
    end if;

    update public.warga_submissions_rt004 set
        status           = 'DISETUJUI',
        matched_warga_id = v_warga_id,
        reviewed_by      = auth.uid(),
        reviewed_at      = now()
    where id = p_submission_id;

    -- BARU: aktifkan akun warga bila pengajuan berasal dari pendaftaran akun.
    if v.akun_user_id is not null then
        update public.warga_akun set
            status        = 'AKTIF',
            warga_id      = v_warga_id,
            nama          = coalesce(nama, v.nama),
            nomor_hp      = coalesce(nomor_hp, v.nomor_hp),
            submission_id = p_submission_id,
            diaktifkan_at = now()
        where id = v.akun_user_id;
    end if;

    return v_warga_id;
end;
$$;

revoke all    on function public.setujui_pendaftaran_warga(uuid, jsonb) from public, anon;
grant  execute on function public.setujui_pendaftaran_warga(uuid, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Perluas RPC penolakan: bila pengajuan bertaut akun, set akun DITOLAK.
-- ---------------------------------------------------------------------
create or replace function public.tolak_pendaftaran_warga(
    p_submission_id uuid,
    p_catatan       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_akun_id uuid;
begin
    if not public.is_pengurus_aktif() then
        raise exception 'Akses ditolak. Hanya pengurus aktif yang dapat menolak.';
    end if;

    select akun_user_id into v_akun_id
    from public.warga_submissions_rt004
    where id = p_submission_id;

    update public.warga_submissions_rt004 set
        status        = 'DITOLAK',
        catatan_admin = nullif(btrim(coalesce(p_catatan, '')), ''),
        reviewed_by   = auth.uid(),
        reviewed_at   = now()
    where id = p_submission_id and status = 'PENDING';

    if not found then
        raise exception 'Pengajuan tidak ditemukan atau sudah diproses.';
    end if;

    if v_akun_id is not null then
        update public.warga_akun set status = 'DITOLAK'
        where id = v_akun_id and status = 'PENDING';
    end if;
end;
$$;

revoke all    on function public.tolak_pendaftaran_warga(uuid, text) from public, anon;
grant  execute on function public.tolak_pendaftaran_warga(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 7. RPC: catat login warga (perbarui terakhir_login + reset gagal_login).
--    Dipanggil aplikasi setelah signInWarga sukses.
-- ---------------------------------------------------------------------
create or replace function public.catat_login_warga()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.warga_akun set
        terakhir_login = now(),
        gagal_login    = 0,
        dikunci_sampai = null
    where id = auth.uid();
end;
$$;

revoke all    on function public.catat_login_warga() from public, anon;
grant  execute on function public.catat_login_warga() to authenticated;


-- ---------------------------------------------------------------------
-- 8. VERIFIKASI — semua baris harus 'OK'
-- ---------------------------------------------------------------------
select 'Tabel warga_akun' as pemeriksaan,
    case when to_regclass('public.warga_akun') is not null
         then 'OK - ada' else 'GAGAL - belum terbentuk' end as status
union all
select 'Kolom akun_user_id di warga_submissions_rt004',
    case when exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'warga_submissions_rt004'
          and column_name = 'akun_user_id'
    ) then 'OK' else 'GAGAL - kolom belum ada' end
union all
select 'Fungsi is_warga_aktif()',
    case when to_regprocedure('public.is_warga_aktif()') is not null
         then 'OK' else 'GAGAL - fungsi belum ada' end
union all
select 'anon TIDAK bisa baca warga_akun',
    case when not has_table_privilege('anon', 'public.warga_akun', 'select')
         then 'OK - anon diblokir' else 'BAHAYA - anon bisa baca akun!' end
union all
select 'RPC setujui_pendaftaran_warga (anon HARUS ditolak)',
    case when not has_function_privilege('anon',
        'public.setujui_pendaftaran_warga(uuid, jsonb)', 'execute')
        then 'OK - anon diblokir' else 'BAHAYA - anon bisa menyetujui!' end
union all
select 'Jumlah akun warga PENDING saat ini',
    coalesce((select count(*) from public.warga_akun where status = 'PENDING'), 0)::text || ' akun';
