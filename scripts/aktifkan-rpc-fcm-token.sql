-- =====================================================================
-- AKTIFKAN RPC PENDAFTARAN FCM TOKEN
--
-- MASALAH YANG DIPERBAIKI
-- Aplikasi memanggil RPC `daftar_fcm_token` sebagai jalur utama untuk
-- menyimpan token notifikasi HP. Fungsi itu BELUM PERNAH dibuat di
-- database, sehingga setiap pendaftaran token harus jatuh ke jalur
-- cadangan (UPSERT langsung ke tabel). Jalur cadangan itu bergantung
-- pada policy RLS anon; begitu policy berubah/terhapus, token gagal
-- tersimpan TANPA pesan error yang terlihat -> Edge Function tidak
-- punya tujuan pengiriman -> HP warga tidak menerima notifikasi.
--
-- Fungsi di bawah memakai SECURITY DEFINER sehingga pendaftaran token
-- selalu berhasil, tidak bisa digagalkan oleh perubahan policy.
--
-- CARA PAKAI:
--   Supabase Dashboard -> SQL Editor -> New query -> tempel -> Run
-- Aman dijalankan berulang kali.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Pastikan tabel token ada (kalau database baru di-reset)
-- ---------------------------------------------------------------------
create table if not exists public.ews_fcm_tokens (
    id          uuid        primary key default gen_random_uuid(),
    token       text        unique not null,
    device_info text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. Fungsi pendaftaran token (SECURITY DEFINER)
--
--    Dipanggil aplikasi dengan:
--      client.rpc('daftar_fcm_token', { p_token, p_device_info })
--
--    Token yang sama cukup memperbarui device_info + updated_at, jadi
--    satu HP tidak menumpuk baris ganda setiap aplikasi dibuka.
-- ---------------------------------------------------------------------
create or replace function public.daftar_fcm_token(
    p_token       text,
    p_device_info text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Tolak token kosong / jelas tidak valid supaya tabel tetap bersih.
    if p_token is null or length(btrim(p_token)) < 20 then
        raise exception 'Token FCM tidak valid.';
    end if;

    insert into public.ews_fcm_tokens (token, device_info)
    values (btrim(p_token), left(coalesce(p_device_info, ''), 300))
    on conflict (token) do update
        set device_info = excluded.device_info,
            updated_at  = now();
end;
$$;

-- Cabut hak eksekusi bawaan, lalu berikan hanya pada peran aplikasi.
revoke all on function public.daftar_fcm_token(text, text) from public;
grant execute on function public.daftar_fcm_token(text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Pastikan hak akses tabel & policy tetap ada (jalur cadangan)
-- ---------------------------------------------------------------------
alter table public.ews_fcm_tokens enable row level security;

grant insert, update         on public.ews_fcm_tokens to anon;
grant select, insert, update on public.ews_fcm_tokens to authenticated;

drop policy if exists "Siapapun boleh daftar FCM token" on public.ews_fcm_tokens;
create policy "Siapapun boleh daftar FCM token"
    on public.ews_fcm_tokens for insert
    to anon, authenticated
    with check (true);

drop policy if exists "Siapapun boleh update FCM token" on public.ews_fcm_tokens;
create policy "Siapapun boleh update FCM token"
    on public.ews_fcm_tokens for update
    to anon, authenticated
    using (true);


-- ---------------------------------------------------------------------
-- 4. VERIFIKASI - semua baris harus 'OK'
-- ---------------------------------------------------------------------
select
    'Fungsi daftar_fcm_token' as pemeriksaan,
    case when exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'daftar_fcm_token'
    ) then 'OK - sudah ada' else 'GAGAL - belum terbentuk' end as status
union all
select
    'Hak execute untuk anon',
    case when has_function_privilege(
        'anon',
        'public.daftar_fcm_token(text, text)',
        'execute'
    ) then 'OK' else 'GAGAL - anon tidak boleh mendaftar token' end
union all
select
    'HP terdaftar menerima notifikasi',
    count(*)::text || ' device'
from public.ews_fcm_tokens;
