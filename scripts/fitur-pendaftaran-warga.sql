-- =====================================================================
-- FITUR: DAFTAR / PERBARUI DATA WARGA (self-service dari aplikasi Android)
--
-- ALUR:
--   1. Warga (TANPA login) mengisi form di aplikasi Android, lalu mengirim
--      lewat RPC `ajukan_pendaftaran_warga`. Data masuk ke tabel karantina
--      `warga_submissions_rt004` berstatus PENDING — TIDAK langsung menyentuh
--      data master `warga_rt004`.
--   2. Warga memantau status lewat RPC `cek_status_pendaftaran_warga(nik)`.
--   3. Pengurus (login Supabase Auth) melihat daftar pengajuan realtime di
--      dashboard, membandingkan dengan data lama, lalu:
--        - `setujui_pendaftaran_warga` -> upsert ke warga_rt004 (semua / sebagian
--          kolom), tandai DISETUJUI.
--        - `tolak_pendaftaran_warga`   -> tandai DITOLAK + catatan.
--
-- KEAMANAN (mengikuti model yang sudah ada):
--   * anon TIDAK punya akses tabel apa pun. Warga hanya bisa lewat 2 RPC
--     SECURITY DEFINER di atas (pola sama seperti `ajukan_surat_warga` &
--     `cek_status_pengajuan`).
--   * RPC persetujuan/penolakan dijaga `public.is_pengurus_aktif()` sehingga
--     hanya pengurus aktif yang bisa mengeksekusi, walau execute diberikan ke
--     seluruh authenticated.
--
-- CARA PAKAI:
--   Supabase Dashboard -> SQL Editor -> New query -> tempel -> Run
--   Aman dijalankan berulang kali (idempoten).
--
-- PRASYARAT: fungsi bantu public.is_pengurus_aktif() sudah dibuat pada skema
--   inti kependudukan (tabel pengurus_profil). Skrip ini memakainya kembali.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabel karantina pengajuan warga
--    Mencerminkan kolom warga_rt004 yang diisi warga, ditambah metadata
--    pengajuan. is_lansia/is_balita/tanggal_input TIDAK disimpan di sini
--    karena diturunkan sistem saat disetujui.
-- ---------------------------------------------------------------------
create table if not exists public.warga_submissions_rt004 (
    id                 uuid        primary key default gen_random_uuid(),

    -- Data warga yang diajukan
    nik                varchar(30) not null,
    nomor_kk           varchar(30),
    nama               text        not null,
    jenis_kelamin      varchar(10),
    tempat_lahir       text,
    tanggal_lahir      date,
    agama              varchar(50) default 'ISLAM',
    pendidikan         varchar(100),
    pekerjaan          varchar(150),
    status_perkawinan  varchar(50),
    status_hubungan_kk varchar(50),
    kewarganegaraan    varchar(30) default 'WNI',
    golongan_darah     varchar(10) default '-',
    nomor_hp           varchar(50),
    email              text,
    status_tinggal     varchar(50) default 'TETAP',
    is_yatim           boolean     default false,
    is_disabilitas     boolean     default false,
    status_bansos      varchar(50) default 'TIDAK_ADA',
    keterangan_bansos  text,
    catatan            text,

    -- Metadata pengajuan
    jenis_pengajuan    varchar(10) not null default 'BARU',    -- BARU | PERBARUI
    status             varchar(10) not null default 'PENDING', -- PENDING | DISETUJUI | DITOLAK
    matched_warga_id   text,           -- id warga_rt004 yang cocok (by NIK) saat diajukan
    catatan_admin      text,
    submitted_at       timestamptz not null default now(),
    reviewed_by        uuid,           -- auth.uid() pengurus yang meninjau
    reviewed_at        timestamptz
);

create index if not exists idx_warga_sub_status on public.warga_submissions_rt004 (status);
create index if not exists idx_warga_sub_nik    on public.warga_submissions_rt004 (nik);
create index if not exists idx_warga_sub_time   on public.warga_submissions_rt004 (submitted_at desc);

-- Kirim baris utuh saat UPDATE/DELETE agar admin menerima data lengkap via realtime.
alter table public.warga_submissions_rt004 replica identity full;


-- ---------------------------------------------------------------------
-- 2. Keamanan tabel: anon dikunci, pengurus aktif boleh baca/hapus.
--    Persetujuan/penolakan dilakukan via RPC (SECURITY DEFINER) sehingga
--    UPDATE tidak perlu dibuka untuk klien.
-- ---------------------------------------------------------------------
alter table public.warga_submissions_rt004 enable row level security;

revoke all on public.warga_submissions_rt004 from anon;
grant  select, delete on public.warga_submissions_rt004 to authenticated;

drop policy if exists "Pengurus aktif baca pengajuan warga"  on public.warga_submissions_rt004;
drop policy if exists "Pengurus aktif hapus pengajuan warga" on public.warga_submissions_rt004;

create policy "Pengurus aktif baca pengajuan warga"
    on public.warga_submissions_rt004 for select
    to authenticated using (public.is_pengurus_aktif());

create policy "Pengurus aktif hapus pengajuan warga"
    on public.warga_submissions_rt004 for delete
    to authenticated using (public.is_pengurus_aktif());


-- ---------------------------------------------------------------------
-- 3. Aktifkan realtime untuk tabel pengajuan (badge & daftar admin).
--    Dibungkus agar tidak error bila tabel sudah terdaftar di publication.
-- ---------------------------------------------------------------------
do $$
begin
    alter publication supabase_realtime add table public.warga_submissions_rt004;
exception
    when duplicate_object then null;  -- sudah terdaftar
    when undefined_object then null;  -- publication belum ada (abaikan)
end $$;


-- ---------------------------------------------------------------------
-- 4. RPC WARGA (anon): kirim pengajuan
--    Mengembalikan id pengajuan (teks) sebagai nomor referensi.
-- ---------------------------------------------------------------------
create or replace function public.ajukan_pendaftaran_warga(
    p_nik                text,
    p_nomor_kk           text,
    p_nama               text,
    p_jenis_kelamin      text default null,
    p_tempat_lahir       text default null,
    p_tanggal_lahir      date default null,
    p_agama              text default 'ISLAM',
    p_pekerjaan          text default null,
    p_status_perkawinan  text default null,
    p_status_hubungan_kk text default null,
    p_golongan_darah     text default '-',
    p_nomor_hp           text default null,
    p_status_tinggal     text default 'TETAP',
    p_is_yatim           boolean default false,
    p_is_disabilitas     boolean default false,
    p_status_bansos      text default 'TIDAK_ADA',
    p_keterangan_bansos  text default null,
    p_catatan            text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_nik      text := btrim(coalesce(p_nik, ''));
    v_nomor_kk text := btrim(coalesce(p_nomor_kk, ''));
    v_nama     text := btrim(coalesce(p_nama, ''));
    v_matched  text;
    v_jenis    text;
    v_id       uuid;
begin
    -- Validasi inti (klien memvalidasi lebih rinci; server jadi lapis akhir).
    if v_nik !~ '^[0-9]{16}$' then
        raise exception 'NIK harus 16 digit angka.';
    end if;
    if length(v_nama) < 2 then
        raise exception 'Nama wajib diisi.';
    end if;
    if v_nomor_kk <> '' and v_nomor_kk !~ '^[0-9]{16}$' then
        raise exception 'Nomor KK harus 16 digit angka.';
    end if;
    if p_tanggal_lahir is null then
        raise exception 'Tanggal lahir wajib diisi.';
    end if;

    -- Anti-spam: tolak bila NIK ini masih punya pengajuan PENDING.
    if exists (
        select 1 from public.warga_submissions_rt004
        where nik = v_nik and status = 'PENDING'
    ) then
        raise exception 'Masih ada pengajuan untuk NIK ini yang sedang diproses pengurus. Mohon tunggu.';
    end if;

    -- Deteksi otomatis BARU vs PERBARUI berdasarkan NIK di data master.
    select id into v_matched from public.warga_rt004 where nik = v_nik limit 1;
    v_jenis := case when v_matched is null then 'BARU' else 'PERBARUI' end;

    insert into public.warga_submissions_rt004 (
        nik, nomor_kk, nama, jenis_kelamin, tempat_lahir, tanggal_lahir,
        agama, pekerjaan, status_perkawinan, status_hubungan_kk, golongan_darah,
        nomor_hp, status_tinggal, is_yatim, is_disabilitas, status_bansos,
        keterangan_bansos, catatan, jenis_pengajuan, matched_warga_id, status
    ) values (
        v_nik, nullif(v_nomor_kk, ''), v_nama,
        upper(nullif(btrim(coalesce(p_jenis_kelamin, '')), '')),
        nullif(btrim(coalesce(p_tempat_lahir, '')), ''), p_tanggal_lahir,
        coalesce(nullif(btrim(coalesce(p_agama, '')), ''), 'ISLAM'),
        nullif(btrim(coalesce(p_pekerjaan, '')), ''),
        nullif(btrim(coalesce(p_status_perkawinan, '')), ''),
        nullif(btrim(coalesce(p_status_hubungan_kk, '')), ''),
        coalesce(nullif(btrim(coalesce(p_golongan_darah, '')), ''), '-'),
        nullif(btrim(coalesce(p_nomor_hp, '')), ''),
        coalesce(nullif(btrim(coalesce(p_status_tinggal, '')), ''), 'TETAP'),
        coalesce(p_is_yatim, false), coalesce(p_is_disabilitas, false),
        coalesce(nullif(btrim(coalesce(p_status_bansos, '')), ''), 'TIDAK_ADA'),
        nullif(btrim(coalesce(p_keterangan_bansos, '')), ''),
        nullif(btrim(coalesce(p_catatan, '')), ''),
        v_jenis, v_matched, 'PENDING'
    )
    returning id into v_id;

    return v_id::text;
end;
$$;

revoke all    on function public.ajukan_pendaftaran_warga(text,text,text,text,text,date,text,text,text,text,text,text,text,boolean,boolean,text,text,text) from public;
grant  execute on function public.ajukan_pendaftaran_warga(text,text,text,text,text,date,text,text,text,text,text,text,text,boolean,boolean,text,text,text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. RPC WARGA (anon): cek status pengajuan berdasarkan NIK
--    Hanya memaparkan metadata status (bukan seluruh PII), untuk pengajuan
--    TERBARU pada NIK tersebut.
-- ---------------------------------------------------------------------
create or replace function public.cek_status_pendaftaran_warga(
    p_nik text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_nik text := btrim(coalesce(p_nik, ''));
    v_row public.warga_submissions_rt004%rowtype;
begin
    if v_nik !~ '^[0-9]{16}$' then
        return json_build_object('ditemukan', false, 'pesan', 'NIK harus 16 digit angka.');
    end if;

    select * into v_row
    from public.warga_submissions_rt004
    where nik = v_nik
    order by submitted_at desc
    limit 1;

    if not found then
        return json_build_object('ditemukan', false, 'pesan', 'Belum ada pengajuan untuk NIK ini.');
    end if;

    return json_build_object(
        'ditemukan',       true,
        'referensi',       v_row.id::text,
        'nama',            v_row.nama,
        'jenisPengajuan',  v_row.jenis_pengajuan,
        'status',          v_row.status,
        'submittedAt',     v_row.submitted_at,
        'reviewedAt',      v_row.reviewed_at,
        'catatanAdmin',    v_row.catatan_admin
    );
end;
$$;

revoke all    on function public.cek_status_pendaftaran_warga(text) from public;
grant  execute on function public.cek_status_pendaftaran_warga(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. RPC PENGURUS: setujui pengajuan
--    p_fields = jsonb array nama kolom (snake_case) yang ingin diterapkan
--    (mode "setujui sebagian"). NULL = terapkan SEMUA kolom.
--    - Bila NIK sudah ada di warga_rt004 -> UPDATE kolom terpilih.
--    - Bila belum ada                     -> INSERT warga baru (semua kolom;
--      p_fields diabaikan karena warga baru butuh data lengkap).
--    is_lansia/is_balita diturunkan dari tanggal_lahir. Mengembalikan id warga.
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
    v         public.warga_submissions_rt004%rowtype;
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
        -- Warga baru: buat id bergaya aplikasi (w-<epoch_ms>) & isi lengkap.
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
        -- Warga sudah ada: perbarui kolom sesuai p_fields (NULL = semua).
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

    return v_warga_id;
end;
$$;

revoke all    on function public.setujui_pendaftaran_warga(uuid, jsonb) from public, anon;
grant  execute on function public.setujui_pendaftaran_warga(uuid, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 7. RPC PENGURUS: tolak pengajuan
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
begin
    if not public.is_pengurus_aktif() then
        raise exception 'Akses ditolak. Hanya pengurus aktif yang dapat menolak.';
    end if;

    update public.warga_submissions_rt004 set
        status        = 'DITOLAK',
        catatan_admin = nullif(btrim(coalesce(p_catatan, '')), ''),
        reviewed_by   = auth.uid(),
        reviewed_at   = now()
    where id = p_submission_id and status = 'PENDING';

    if not found then
        raise exception 'Pengajuan tidak ditemukan atau sudah diproses.';
    end if;
end;
$$;

revoke all    on function public.tolak_pendaftaran_warga(uuid, text) from public, anon;
grant  execute on function public.tolak_pendaftaran_warga(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 8. VERIFIKASI — semua baris harus 'OK'
-- ---------------------------------------------------------------------
select 'Tabel warga_submissions_rt004' as pemeriksaan,
    case when to_regclass('public.warga_submissions_rt004') is not null
         then 'OK - ada' else 'GAGAL - belum terbentuk' end as status
union all
select 'RPC ajukan_pendaftaran_warga (anon)',
    case when has_function_privilege('anon',
        'public.ajukan_pendaftaran_warga(text,text,text,text,text,date,text,text,text,text,text,text,text,boolean,boolean,text,text,text)',
        'execute') then 'OK' else 'GAGAL - anon tidak boleh mengajukan' end
union all
select 'RPC cek_status_pendaftaran_warga (anon)',
    case when has_function_privilege('anon',
        'public.cek_status_pendaftaran_warga(text)', 'execute')
        then 'OK' else 'GAGAL - anon tidak boleh cek status' end
union all
select 'RPC setujui_pendaftaran_warga (anon HARUS ditolak)',
    case when not has_function_privilege('anon',
        'public.setujui_pendaftaran_warga(uuid, jsonb)', 'execute')
        then 'OK - anon diblokir' else 'BAHAYA - anon bisa menyetujui!' end
union all
select 'Realtime aktif untuk pengajuan',
    case when exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'warga_submissions_rt004'
    ) then 'OK' else 'PERIKSA - belum masuk publication supabase_realtime' end
union all
select 'Jumlah pengajuan pending saat ini',
    coalesce((select count(*) from public.warga_submissions_rt004 where status = 'PENDING'), 0)::text || ' pengajuan';
