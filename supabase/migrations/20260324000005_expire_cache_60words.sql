-- Expire all articles to reprocess with 60-word Inshorts-style summaries.
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    ai_title   = NULL,
    ai_summary = NULL;
