-- Expire all cached articles to force reprocessing with new OpenRouter key
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    ai_title = NULL,
    ai_summary = NULL
WHERE expires_at > NOW();
