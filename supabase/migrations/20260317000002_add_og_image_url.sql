-- Add og_image_url column to store Open Graph images extracted from article pages.
-- This gives better thumbnails than RSS feed images (which are often missing/tiny).
ALTER TABLE public.cached_articles
  ADD COLUMN IF NOT EXISTS og_image_url TEXT;
