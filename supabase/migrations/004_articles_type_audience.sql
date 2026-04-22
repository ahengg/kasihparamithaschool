-- ============================================================
-- 004 — Articles type (article/announcement) + audience category
-- Jalankan di: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- Pemisahan artikel publik vs pengumuman:
--   type='article'      → konten publik biasa, tampil di artikel.html
--   type='announcement' → pengumuman, tampil di pengumuman.html
--
-- Audience hanya berlaku untuk pengumuman:
--   audience_category_id IS NULL  → publik / semua kategori (no-login OK)
--   audience_category_id = <id>   → hanya untuk user terdaftar di kategori
--
-- Artikel lama otomatis default 'article' supaya kompatibel dengan halaman
-- artikel.html yang lama.

-- 1. Kolom type — default 'article' agar baris lama tetap valid
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'article'
  CHECK (type IN ('article', 'announcement'));

CREATE INDEX IF NOT EXISTS articles_type_idx
  ON public.articles (type);

-- 2. Kolom audience_category_id — nullable
--    NULL = pengumuman publik (untuk semua), atau tidak relevan untuk articles
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS audience_category_id SMALLINT
  REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS articles_audience_idx
  ON public.articles (audience_category_id);

-- 3. Kombinasi index untuk query pengumuman terfilter
CREATE INDEX IF NOT EXISTS articles_type_audience_idx
  ON public.articles (type, audience_category_id, created_at DESC);
