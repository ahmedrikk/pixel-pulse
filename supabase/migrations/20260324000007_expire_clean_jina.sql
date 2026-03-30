-- Reprocess with cleanJinaText() — strips markdown nav links from summaries.
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    ai_title   = NULL,
    ai_summary = NULL;
