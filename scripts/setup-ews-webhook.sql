-- =====================================================================
-- SETUP DATABASE WEBHOOK UNTUK EWS PUSH NOTIFICATION
-- Script ini membuat webhook yang memanggil Edge Function saat ada
-- laporan EWS baru masuk (INSERT ke ews_laporan_rt004).
-- =====================================================================

-- CATATAN:
-- Database Webhook di Supabase lebih mudah dikonfigurasi via Dashboard UI.
-- Script SQL ini hanya untuk referensi. Gunakan Supabase Dashboard:
-- 
-- Database → Webhooks → Create a new hook
-- - Name: ews-notif-trigger
-- - Table: ews_laporan_rt004
-- - Events: Insert
-- - Type: HTTP Request
-- - Method: POST
-- - URL: https://<project-ref>.supabase.co/functions/v1/kirim-notif-ews
-- - HTTP Headers:
--     Authorization: Bearer <SUPABASE_ANON_KEY>

-- Alternatif: gunakan pg_net extension untuk HTTP request dari database trigger
-- (Memerlukan pg_net extension enabled di Supabase)

-- LANGKAH 1: Enable pg_net extension (jika belum)
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- LANGKAH 2: Buat fungsi trigger yang memanggil Edge Function
CREATE OR REPLACE FUNCTION public.trigger_ews_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_url TEXT;
  anon_key TEXT;
  function_url TEXT;
  request_id BIGINT;
BEGIN
  -- Ambil project URL dan anon key dari environment atau hardcode
  -- CATATAN: Supabase tidak menyediakan cara aman untuk menyimpan URL/key di database.
  -- Untuk production, gunakan Supabase Dashboard Webhook UI daripada trigger SQL.
  
  project_url := current_setting('app.settings.supabase_url', true);
  anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  IF project_url IS NULL OR anon_key IS NULL THEN
    RAISE WARNING 'Supabase URL atau Anon Key tidak dikonfigurasi. Webhook tidak dipanggil.';
    RETURN NEW;
  END IF;
  
  function_url := project_url || '/functions/v1/kirim-notif-ews';
  
  -- Kirim HTTP POST request via pg_net
  -- CATATAN: pg_net.http_post adalah async dan tidak menunggu response
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'ews_laporan_rt004',
      'record', row_to_json(NEW)
    )
  ) INTO request_id;
  
  RAISE LOG 'EWS push notification triggered via pg_net. Request ID: %', request_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error tapi jangan blokir INSERT laporan
    RAISE WARNING 'Error triggering EWS push notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- LANGKAH 3: Buat trigger AFTER INSERT
DROP TRIGGER IF EXISTS trg_ews_push_notification ON ews_laporan_rt004;

CREATE TRIGGER trg_ews_push_notification
  AFTER INSERT ON ews_laporan_rt004
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ews_push_notification();

-- =====================================================================
-- KONFIGURASI PROJECT URL DAN ANON KEY (opsional, hanya jika pakai trigger SQL)
-- Set via ALTER DATABASE atau session-level config
-- =====================================================================

-- Contoh set via session:
-- SET app.settings.supabase_url = 'https://xyzproject.supabase.co';
-- SET app.settings.supabase_anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

-- Atau set via ALTER DATABASE (persistent):
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://xyzproject.supabase.co';
-- ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

-- =====================================================================
-- REKOMENDASI:
-- Gunakan Supabase Dashboard UI untuk membuat webhook, bukan script SQL ini.
-- Dashboard UI lebih aman karena credentials tidak tersimpan di database.
-- =====================================================================
