UPDATE public.cached_articles
SET expires_at = '2000-01-01'::timestamptz,
    ai_title = NULL,
    ai_summary = NULL,
    tags = '{}';
