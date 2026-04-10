-- ============================================================
-- Materials table + Storage bucket setup
-- Jalankan di: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Buat tabel materials
CREATE TABLE IF NOT EXISTS public.materials (
  id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT          NOT NULL,
  description TEXT,
  file_url    TEXT          NOT NULL,
  file_name   TEXT          NOT NULL,
  file_size   BIGINT,
  status      TEXT          NOT NULL DEFAULT 'published',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2. Index untuk query cepat
CREATE INDEX IF NOT EXISTS materials_status_created_idx
  ON public.materials (status, created_at DESC);

-- 3. RLS — aktifkan Row Level Security
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- 4. Policy: siapa saja (termasuk anon) bisa READ materi published
CREATE POLICY "materials_public_read"
  ON public.materials
  FOR SELECT
  USING (status = 'published');

-- 5. Policy: hanya service_role (Edge Function) yang bisa INSERT/UPDATE/DELETE
--    Edge Function menggunakan SUPABASE_SERVICE_ROLE_KEY, bukan JWT user,
--    sehingga bypass RLS secara otomatis. Policies di bawah ini adalah
--    fallback jika ada akses langsung via REST.
CREATE POLICY "materials_service_write"
  ON public.materials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Storage bucket: materials
-- ============================================================

-- 6. Buat bucket (public = file bisa diakses via URL publik)
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Policy storage: siapa saja bisa READ file dari bucket materials
CREATE POLICY "materials_storage_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'materials');

-- 8. Policy storage: hanya authenticated user yang bisa UPLOAD
--    (validasi role admin dilakukan di Edge Function, bukan di sini)
CREATE POLICY "materials_storage_auth_upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'materials');

-- 9. Policy storage: hanya authenticated user yang bisa DELETE
CREATE POLICY "materials_storage_auth_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'materials');
