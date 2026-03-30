-- Switch to text-extraction summaries (no AI generation).
-- Expire everything so articles get reprocessed with Jina first-60-words approach.
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    ai_title   = NULL,
    ai_summary = NULL;
