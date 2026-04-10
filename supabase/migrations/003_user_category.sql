-- ============================================================
-- 003 — Replace user_enrollments with users.category_id
-- Jalankan di: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Drop junction table (replaced by direct FK on users)
DROP TABLE IF EXISTS public.user_enrollments CASCADE;

-- 2. Add single class column to users (nullable — admin/editor have no class)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS category_id SMALLINT
  REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_category_idx
  ON public.users (category_id);
