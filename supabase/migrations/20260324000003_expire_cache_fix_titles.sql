-- Force reprocess: AI was replacing original titles with short generic ones.
-- ai_title now always uses the original RSS title.
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    ai_title   = NULL,
    ai_summary = NULL;
