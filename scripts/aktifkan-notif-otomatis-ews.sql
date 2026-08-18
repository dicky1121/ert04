-- =====================================================================
-- AKTIFKAN NOTIFIKASI EWS OTOMATIS
-- Membuat trigger yang memanggil Edge Function `kirim-notif-ews`
-- setiap kali ada laporan darurat baru masuk.
--
-- Ini pengganti "Database Webhook" di Dashboard — hasilnya sama,
-- tapi cukup sekali tempel-jalankan.
--
-- CARA PAKAI: buka versi file ini yang sudah terisi kunci
-- (dihasilkan oleh perintah di terminal), salin seluruh isinya,
-- lalu tempel di Supabase Dashboard -> SQL Editor -> Run.
--
-- Aman dijalankan berulang kali.
-- =====================================================================

-- Pastikan pg_net tersedia (dipakai untuk memanggil HTTP dari database)
create extension if not exists pg_net;

do $blok$
declare
  v_url    text := 'https://nginmiqjfzycvbbufbev.supabase.co/functions/v1/kirim-notif-ews';
  v_key    text := '__ANON_KEY__';
  v_ada_sf boolean;
begin
  if v_key = '__ANON' || '_KEY__' then
    raise exception 'Kunci belum terisi. Jangan jalankan file template ini — pakai file hasil generate.';
  end if;

  -- Supabase menyediakan supabase_functions.http_request bila fitur
  -- Database Webhooks pernah aktif. Pakai itu bila ada.
  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'supabase_functions'
      and p.proname = 'http_request'
  ) into v_ada_sf;

  drop trigger if exists trg_ews_notif_otomatis on public.ews_laporan_rt004;

  if v_ada_sf then
    execute format(
      'create trigger trg_ews_notif_otomatis
         after insert on public.ews_laporan_rt004
         for each row
         execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
      v_url,
      'POST',
      json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      )::text,
      '{}',
      '5000'
    );
    raise notice 'Trigger dibuat memakai supabase_functions.http_request';

  else
    -- Jalur cadangan: panggil pg_net langsung.
    -- http_post ditulis tanpa nama skema agar tetap ketemu baik saat
    -- pg_net terpasang di skema `net` maupun `extensions`.
    execute format($fn$
      create or replace function public.kirim_notif_ews_otomatis()
      returns trigger
      language plpgsql
      security definer
      set search_path = public, net, extensions
      as $isi$
      declare
        v_req bigint;
      begin
        select http_post(
          url     := %L,
          headers := jsonb_build_object(
                       'Content-Type', 'application/json',
                       'Authorization', 'Bearer ' || %L
                     ),
          body    := jsonb_build_object(
                       'type',   'INSERT',
                       'table',  'ews_laporan_rt004',
                       'record', to_jsonb(new)
                     )
        ) into v_req;
        return new;
      exception when others then
        -- Jangan pernah menggagalkan penyimpanan laporan darurat
        -- hanya karena notifikasi gagal terkirim.
        raise warning 'Notifikasi EWS gagal dikirim: %%', sqlerrm;
        return new;
      end
      $isi$;
    $fn$, v_url, v_key);

    create trigger trg_ews_notif_otomatis
      after insert on public.ews_laporan_rt004
      for each row
      execute function public.kirim_notif_ews_otomatis();

    raise notice 'Trigger dibuat memakai pg_net (http_post)';
  end if;
end
$blok$;


-- ---------------------------------------------------------------------
-- Hapus trigger lama yang tidak berfungsi (bila masih ada).
-- Versi itu membaca current_setting('app.settings.supabase_url') yang
-- default-nya NULL, jadi hanya menulis WARNING tanpa mengirim apa pun.
-- ---------------------------------------------------------------------
drop trigger  if exists trg_ews_push_notification on public.ews_laporan_rt004;
drop function if exists public.trigger_ews_push_notification();


-- ---------------------------------------------------------------------
-- Bersihkan baris uji
-- ---------------------------------------------------------------------
delete from public.ews_laporan_rt004
where nama_pelapor in ('ZZ-UJI-WEBHOOK', 'Uji Webhook', 'ZZ-DIAGNOSTIK')
   or deskripsi like 'UJI OTOMATIS%';


-- ---------------------------------------------------------------------
-- VERIFIKASI
-- ---------------------------------------------------------------------
select
  'Trigger notifikasi otomatis' as pemeriksaan,
  case when exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'ews_laporan_rt004'
      and t.tgname  = 'trg_ews_notif_otomatis'
  ) then 'AKTIF' else 'GAGAL TERBENTUK' end as status
union all
select
  'Trigger lama (bermasalah)',
  case when exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'ews_laporan_rt004'
      and t.tgname  = 'trg_ews_push_notification'
  ) then 'MASIH ADA' else 'sudah bersih' end
union all
select
  'HP terdaftar menerima notifikasi',
  count(*)::text || ' device'
from public.ews_fcm_tokens;
