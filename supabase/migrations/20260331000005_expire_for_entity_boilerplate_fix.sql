-- Expire all articles to reprocess with named entity decoding and boilerplate removal fixes.
UPDATE public.cached_articles SET expires_at = '2000-01-01', ai_summary = NULL;
