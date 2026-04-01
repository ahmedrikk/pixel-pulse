-- Expire all articles to reprocess with article scraper for short RSS descriptions.
UPDATE public.cached_articles SET expires_at = '2000-01-01', ai_summary = NULL;
