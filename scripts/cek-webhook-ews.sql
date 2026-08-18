-- =====================================================================
-- DIAGNOSTIK: apakah notifikasi EWS terkirim OTOMATIS saat laporan masuk?
-- Jalankan seluruh isi file ini di Supabase Dashboard -> SQL Editor -> Run.
-- Tidak mengubah apa pun, hanya membaca status.
-- =====================================================================

-- 1) Apakah ada trigger di tabel laporan EWS?
select
  '1. TRIGGER di ews_laporan_rt004' as pemeriksaan,
  coalesce(string_agg(t.tgname, ', '), '(TIDAK ADA)') as hasil
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where c.relname = 'ews_laporan_rt004'
  and not t.tgisinternal;

-- 2) Apakah Database Webhook dari Dashboard sudah dibuat?
--    Webhook Dashboard membuat trigger yang memanggil supabase_functions.http_request.
select
  '2. WEBHOOK dashboard' as pemeriksaan,
  case
    when count(*) > 0 then 'ADA (' || count(*) || ' trigger http_request)'
    else '(TIDAK ADA) -> notifikasi TIDAK otomatis'
  end as hasil
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where c.relname = 'ews_laporan_rt004'
  and not t.tgisinternal
  and pg_get_triggerdef(t.oid) ilike '%http_request%';

-- 3) Apakah trigger versi SQL lama (yang tidak berfungsi) masih terpasang?
--    Versi itu memakai current_setting('app.settings.supabase_url') yang NULL,
--    sehingga hanya menulis WARNING tanpa mengirim notifikasi.
select
  '3. TRIGGER SQL lama (bermasalah)' as pemeriksaan,
  case
    when count(*) > 0 then 'MASIH ADA -> sebaiknya dihapus (lihat catatan bawah)'
    else 'tidak ada (bagus)'
  end as hasil
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where c.relname = 'ews_laporan_rt004'
  and t.tgname = 'trg_ews_push_notification';

-- 4) Berapa HP yang terdaftar menerima notifikasi?
select
  '4. FCM token terdaftar' as pemeriksaan,
  count(*)::text || ' device' as hasil
from ews_fcm_tokens;

-- 5) Daftar device (token disamarkan)
select
  left(token, 12) || '...' as token_disamarkan,
  device_info,
  created_at
from ews_fcm_tokens
order by created_at desc
limit 10;

-- =====================================================================
-- CARA MEMBACA HASIL
-- =====================================================================
-- Baris 2 = "ADA"          -> notifikasi sudah otomatis. Selesai.
-- Baris 2 = "(TIDAK ADA)"  -> buat webhook lewat Dashboard:
--     Database -> Webhooks -> Create a new hook
--       Name   : ews-notif-trigger
--       Table  : ews_laporan_rt004
--       Events : Insert
--       Type   : HTTP Request  |  Method: POST
--       URL    : https://nginmiqjfzycvbbufbev.supabase.co/functions/v1/kirim-notif-ews
--       Header : Authorization = Bearer <SUPABASE_ANON_KEY>
--
-- Baris 3 = "MASIH ADA" -> hapus trigger lama yang tidak berfungsi:
--     drop trigger if exists trg_ews_push_notification on ews_laporan_rt004;
--     drop function if exists public.trigger_ews_push_notification();
-- =====================================================================
