-- Expire all articles to reprocess with boilerplate removal and entity decoding fixes.
UPDATE public.cached_articles SET expires_at = '2000-01-01', ai_summary = NULL;
