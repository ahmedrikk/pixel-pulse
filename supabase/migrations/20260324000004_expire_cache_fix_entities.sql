-- Expire cache so articles get reprocessed with decoded HTML entities in titles.
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    ai_title   = NULL,
    ai_summary = NULL;
