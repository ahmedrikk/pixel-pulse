-- Force all cached articles to be re-processed by the updated AI edge function.
-- Resets expires_at to the past and clears ai_title/ai_summary so fresh
-- 280-char summaries and contextual hashtags are generated on next load.
UPDATE public.cached_articles
SET
  expires_at  = '2000-01-01 00:00:00+00',
  ai_title    = NULL,
  ai_summary  = NULL;
