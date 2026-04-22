-- ============================================================
-- 005 — Cron cleanup: hapus pengumuman & materi yang sudah > 5 hari kerja
-- Jalankan di: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- LANGKAH SETUP (dipisah karena CREATE EXTENSION butuh superuser & dijalankan
-- terpisah dari pemakaiannya):
--
--   STEP A — Aktifkan extension lewat Dashboard:
--     Database → Extensions → cari & aktifkan:
--       • pg_cron   (skema: extensions, lalu otomatis create skema "cron")
--       • pg_net    (skema: extensions)
--     ATAU jalankan via SQL editor (sekali saja, di transaction terpisah):
--       CREATE EXTENSION IF NOT EXISTS pg_cron;
--       CREATE EXTENSION IF NOT EXISTS pg_net;
--
--   STEP B — Set GUC (jalankan SEKALI):
--     ALTER DATABASE postgres SET app.supabase_url   = 'https://<project>.supabase.co';
--     ALTER DATABASE postgres SET app.supabase_anon  = '<anon-key>';
--     ALTER DATABASE postgres SET app.cleanup_secret = '<random-string-rahasia>';
--     -- Lalu DISCONNECT/reconnect SQL editor agar GUC ke-load.
--     -- Secret yang sama harus disimpan di Edge Function env: CLEANUP_SECRET.
--
--   STEP C — Jalankan file ini (akan bikin helper function + schedule cron).
--
-- Kenapa Edge Function dipanggil, bukan langsung DELETE di SQL?
--   Karena materials punya file di Supabase Storage. SQL DELETE tidak
--   menghapus file di bucket — Edge Function akan hapus row + file storage.
--
-- Definisi "1 minggu kerja" = 5 hari kerja (Senin–Jumat). Akhir pekan
-- (Sabtu/Minggu) tidak dihitung. Lihat business_days_between() di bawah.

-- ------------------------------------------------------------
-- 0. Pastikan extension aktif (idempotent; aman di-rerun).
--    Kalau gagal "permission denied", aktifkan via Dashboard → Database
--    → Extensions, lalu jalankan ulang file ini.
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ------------------------------------------------------------
-- 1. Helper: hitung jumlah hari kerja antara 2 timestamp
-- ------------------------------------------------------------
-- Mengembalikan jumlah hari kerja (Senin–Jumat) yang sudah lewat
-- antara start_ts dan end_ts. Hari mulai (start_ts) tidak dihitung.
CREATE OR REPLACE FUNCTION public.business_days_between(start_ts TIMESTAMPTZ, end_ts TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d   DATE;
  cnt INTEGER := 0;
BEGIN
  IF end_ts <= start_ts THEN
    RETURN 0;
  END IF;
  d := (start_ts AT TIME ZONE 'Asia/Jakarta')::date + 1;
  WHILE d <= (end_ts AT TIME ZONE 'Asia/Jakarta')::date LOOP
    IF EXTRACT(DOW FROM d) NOT IN (0, 6) THEN  -- 0=Sunday, 6=Saturday
      cnt := cnt + 1;
    END IF;
    d := d + 1;
  END LOOP;
  RETURN cnt;
END;
$$;

-- ------------------------------------------------------------
-- 2. Cron job: panggil Edge Function /CRUD/cleanup setiap hari
-- ------------------------------------------------------------
-- Jalan jam 00:00 WIB = 17:00 UTC. Edge Function /cleanup akan
-- menghapus pengumuman + materi yang business_days_between(created_at, NOW()) >= 5.

-- Hapus job lama jika sudah ada (idempotent re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-pengumuman-materi');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup-pengumuman-materi',
  '0 17 * * *',  -- 17:00 UTC = 00:00 WIB (Indonesia midnight)
  $job$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/CRUD/cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon', true),
        'x-cleanup-secret', current_setting('app.cleanup_secret', true)
      ),
      body    := '{}'::jsonb
    );
  $job$
);

-- Catatan: app.supabase_url & app.supabase_anon juga harus di-set:
--   ALTER DATABASE postgres SET app.supabase_url   = 'https://<project>.supabase.co';
--   ALTER DATABASE postgres SET app.supabase_anon  = '<anon-key>';
--   ALTER DATABASE postgres SET app.cleanup_secret = '<random-string-rahasia>';
