-- =====================================================================
-- DIAGNOSA NOTIFIKASI EWS - SATU TABEL HASIL
--
-- Menjawab pertanyaan: "data masuk ke EWS darurat, tapi kenapa tidak ada
-- notifikasi yang sampai di HP warga?"
--
-- Skrip ini HANYA MEMBACA (read-only). Tidak mengubah apa pun.
--
-- CARA PAKAI:
--   Supabase Dashboard -> SQL Editor -> New query -> tempel -> Run
--   Lalu baca kolom "status". Perbaiki baris yang BUKAN 'OK', urut dari
--   nomor terkecil - rantai notifikasi berjalan berurutan.
-- =====================================================================

with
-- 1) HP terdaftar. Ini penyebab paling sering: tanpa token, Edge Function
--    tidak punya tujuan pengiriman sama sekali.
langkah1 as (
    select
        '1. HP terdaftar (ews_fcm_tokens)' as langkah,
        count(*)::text || ' device' as temuan,
        case
            when count(*) = 0
                then 'MASALAH UTAMA - belum ada HP terdaftar. Notifikasi TIDAK MUNGKIN terkirim. Penyebab: APK di HP memakai kode lama, atau izin notifikasi ditolak. Build ulang APK lalu pasang ulang di HP.'
            else 'OK'
        end as status
    from public.ews_fcm_tokens
),

-- 2) Fungsi RPC yang dipakai aplikasi untuk menyimpan token.
langkah2 as (
    select
        '2. Fungsi daftar_fcm_token' as langkah,
        case when exists (
            select 1 from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'daftar_fcm_token'
        ) then 'ada' else 'tidak ada' end as temuan,
        case when exists (
            select 1 from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'daftar_fcm_token'
        ) then 'OK'
        else 'PERBAIKI - jalankan scripts/aktifkan-rpc-fcm-token.sql. Tanpa fungsi ini pendaftaran token bergantung pada policy RLS dan bisa gagal diam-diam.'
        end as status
),

-- 3) Trigger yang memanggil Edge Function saat laporan masuk.
langkah3 as (
    select
        '3. Trigger notifikasi otomatis' as langkah,
        coalesce((
            select string_agg(t.tgname, ', ')
            from pg_trigger t
            join pg_class c on c.oid = t.tgrelid
            where c.relname = 'ews_laporan_rt004' and not t.tgisinternal
        ), 'tidak ada') as temuan,
        case when exists (
            select 1
            from pg_trigger t
            join pg_class c on c.oid = t.tgrelid
            where c.relname = 'ews_laporan_rt004'
              and not t.tgisinternal
              and (pg_get_triggerdef(t.oid) ilike '%http_request%'
                   or pg_get_triggerdef(t.oid) ilike '%kirim_notif_ews%')
        ) then 'OK'
        else 'PERBAIKI - laporan tersimpan tetapi Edge Function tidak pernah dipanggil. Jalankan scripts/aktifkan-notif-otomatis-ews.sql.'
        end as status
),

-- 4) Extension pg_net, dipakai trigger untuk memanggil HTTP.
langkah4 as (
    select
        '4. Extension pg_net' as langkah,
        coalesce((select extversion from pg_extension where extname = 'pg_net'), 'belum terpasang') as temuan,
        case when exists (select 1 from pg_extension where extname = 'pg_net')
            then 'OK'
            else 'PERBAIKI - jalankan: create extension if not exists pg_net;'
        end as status
),

-- 5) Realtime, untuk badge di dashboard pengurus (bukan penyebab notif HP).
langkah5 as (
    select
        '5. Realtime laporan EWS' as langkah,
        case when exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public' and tablename = 'ews_laporan_rt004'
        ) then 'aktif' else 'tidak aktif' end as temuan,
        case when exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public' and tablename = 'ews_laporan_rt004'
        ) then 'OK'
        else 'PERHATIAN - badge di dashboard pengurus tidak bertambah otomatis (tidak memengaruhi notifikasi HP).'
        end as status
),

-- 6) Bukti laporan memang masuk.
langkah6 as (
    select
        '6. Laporan EWS masuk' as langkah,
        count(*)::text || ' laporan' as temuan,
        case when count(*) = 0
            then 'PERHATIAN - belum ada laporan. Kirim satu laporan uji dari aplikasi.'
            else 'OK'
        end as status
    from public.ews_laporan_rt004
),

-- 7) Riwayat panggilan HTTP oleh pg_net. Inilah bukti apakah trigger
--    benar-benar menembak Edge Function dan apa jawabannya.
langkah7 as (
    select
        '7. Panggilan terakhir ke Edge Function' as langkah,
        case
            when not exists (
                select 1 from information_schema.tables
                where table_schema = 'net' and table_name = '_http_response'
            ) then 'riwayat pg_net tidak tersedia'
            else coalesce((
                select 'HTTP ' || coalesce(r.status_code::text, 'gagal') ||
                       ' pada ' || to_char(r.created, 'DD Mon HH24:MI')
                from net._http_response r
                order by r.created desc
                limit 1
            ), 'belum pernah ada panggilan')
        end as temuan,
        case
            when not exists (
                select 1 from information_schema.tables
                where table_schema = 'net' and table_name = '_http_response'
            ) then 'LEWATI - tidak bisa diperiksa dari sini, cek log Edge Function di Dashboard.'
            when not exists (select 1 from net._http_response)
                then 'PERBAIKI - trigger belum pernah memanggil Edge Function (lihat langkah 3).'
            when exists (
                select 1 from net._http_response r
                where r.status_code between 200 and 299
                  and r.created > now() - interval '7 days'
            ) then 'OK - Edge Function membalas sukses. Bila HP tetap sunyi, periksa langkah 1 dan izin notifikasi di HP.'
            else 'PERBAIKI - Edge Function membalas error. Buka log-nya di Dashboard: Edge Functions > kirim-notif-ews > Logs.'
        end as status
)

select langkah, temuan, status from langkah1
union all select langkah, temuan, status from langkah2
union all select langkah, temuan, status from langkah3
union all select langkah, temuan, status from langkah4
union all select langkah, temuan, status from langkah5
union all select langkah, temuan, status from langkah6
union all select langkah, temuan, status from langkah7
order by langkah;

-- =====================================================================
-- CATATAN PENTING
--
-- Bila langkah 1 = 0 device, seluruh langkah lain tidak ada gunanya:
-- tidak ada tujuan pengiriman. Ini yang terjadi bila APK yang dipasang
-- di HP warga dibangun SEBELUM kode pendaftaran token diperbaiki.
--
-- Urutan perbaikan yang benar:
--   1. Jalankan scripts/aktifkan-rpc-fcm-token.sql        (database)
--   2. npm run build && npx cap sync android              (bundle)
--   3. cd android && .\gradlew assembleRelease            (APK baru)
--   4. Uninstall aplikasi lama di HP, pasang APK baru, izinkan notifikasi
--   5. Jalankan ulang skrip ini - langkah 1 harus bertambah
-- =====================================================================
