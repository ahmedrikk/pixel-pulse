-- Expire all cached articles so they get reprocessed with the new 100-word summary prompt.
UPDATE public.cached_articles
SET
  expires_at = '2000-01-01 00:00:00+00',
  ai_title   = NULL,
  ai_summary = NULL
WHERE expires_at > NOW();
