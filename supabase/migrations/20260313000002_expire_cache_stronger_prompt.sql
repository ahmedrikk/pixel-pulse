-- Force reprocessing with the stronger 270-280 char summary prompt
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    ai_title = NULL,
    ai_summary = NULL
WHERE expires_at > NOW();
