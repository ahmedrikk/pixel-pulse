-- Expire Eurogamer articles that were contaminated with sidebar content.
-- fetch-news now detects sidebar-like text and falls back to RSS description.
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    ai_title   = NULL,
    ai_summary = NULL
WHERE source = 'Eurogamer';
