-- Re-expire cache so articles are reprocessed with agent-style tag extraction
UPDATE public.cached_articles
SET expires_at = '2000-01-01 00:00:00+00', ai_title = NULL, ai_summary = NULL;
