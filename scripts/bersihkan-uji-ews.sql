-- =====================================================================
-- BERSIHKAN DATA UJI EWS
--
-- Menghapus baris laporan UJI yang dibuat saat pengujian webhook/FCM.
-- Data laporan ASLI dari warga TIDAK tersentuh (filter hanya mengenai
-- nama pelapor / deskripsi khusus pengujian).
--
-- CARA JALANKAN:
--   Supabase Dashboard -> SQL Editor -> New query -> paste -> Run (F5)
-- =====================================================================

-- 1. Lihat dulu apa yang akan dihapus (aman, tidak mengubah data)
select id, jenis_kejadian, nama_pelapor, deskripsi, status, created_at
from public.ews_laporan_rt004
where nama_pelapor in ('ZZ-UJI-WEBHOOK', 'Uji Webhook', 'Uji Sistem', 'ZZ-DIAGNOSTIK')
   or deskripsi like 'UJI OTOMATIS%'
order by created_at desc;

-- 2. Hapus baris uji
delete from public.ews_laporan_rt004
where nama_pelapor in ('ZZ-UJI-WEBHOOK', 'Uji Webhook', 'Uji Sistem', 'ZZ-DIAGNOSTIK')
   or deskripsi like 'UJI OTOMATIS%';

-- 3. Verifikasi: hasilnya HARUS 0
select count(*) as sisa_baris_uji
from public.ews_laporan_rt004
where nama_pelapor in ('ZZ-UJI-WEBHOOK', 'Uji Webhook', 'Uji Sistem', 'ZZ-DIAGNOSTIK')
   or deskripsi like 'UJI OTOMATIS%';

-- 4. (Opsional) Cek sisa laporan asli yang ada di database
select count(*) as total_laporan_tersisa from public.ews_laporan_rt004;
