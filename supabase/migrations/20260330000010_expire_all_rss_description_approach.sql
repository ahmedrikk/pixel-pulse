-- Switch to RSS description summaries — no Jina content scraping.
-- Expire all articles so they get reprocessed with the simplified pipeline.
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    ai_title   = NULL,
    ai_summary = NULL;
