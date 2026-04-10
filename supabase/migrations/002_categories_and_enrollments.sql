-- ============================================================
-- 002 — Categories, Materials category_id, User Enrollments
-- Jalankan di: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tabel categories (lookup)
CREATE TABLE IF NOT EXISTS public.categories (
  id   SMALLSERIAL  PRIMARY KEY,
  name TEXT         NOT NULL UNIQUE
);

-- 2. Seed 8 kategori
INSERT INTO public.categories (name) VALUES
  ('KG A'),
  ('KG B'),
  ('PG A'),
  ('PG B'),
  ('ROBOTICS / CODING'),
  ('Calistung'),
  ('English Mathematic'),
  ('Sensoric')
ON CONFLICT (name) DO NOTHING;

-- 3. Tambah kolom category_id ke materials (nullable — materi bisa umum)
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS category_id SMALLINT
  REFERENCES public.categories(id) ON DELETE SET NULL;

-- Index agar filter category cepat
CREATE INDEX IF NOT EXISTS materials_category_idx
  ON public.materials (category_id);

-- 4. Tabel user_enrollments: many-to-many users ↔ categories
--    Setiap user (orang tua / murid) bisa terdaftar di 1+ kategori/kelas
CREATE TABLE IF NOT EXISTS public.user_enrollments (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id SMALLINT     NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category_id)
);

CREATE INDEX IF NOT EXISTS enrollments_user_idx
  ON public.user_enrollments (user_id);
CREATE INDEX IF NOT EXISTS enrollments_category_idx
  ON public.user_enrollments (category_id);

-- ============================================================
-- RLS
-- ============================================================

-- categories: siapa saja bisa baca
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_public_read"  ON public.categories;
DROP POLICY IF EXISTS "categories_service_write" ON public.categories;
CREATE POLICY "categories_public_read"
  ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories_service_write"
  ON public.categories FOR ALL TO service_role USING (true) WITH CHECK (true);

-- user_enrollments: user hanya bisa baca milik sendiri, service_role bisa semua
ALTER TABLE public.user_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "enrollments_own_read"   ON public.user_enrollments;
DROP POLICY IF EXISTS "enrollments_service_all" ON public.user_enrollments;
CREATE POLICY "enrollments_own_read"
  ON public.user_enrollments FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "enrollments_service_all"
  ON public.user_enrollments FOR ALL TO service_role USING (true) WITH CHECK (true);
