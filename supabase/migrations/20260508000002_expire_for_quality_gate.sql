-- Expire all articles to re-run them through the new quality gate (50-100 words, 3+ sentences, no trailing ellipsis)
UPDATE public.cached_articles
SET expires_at = '2000-01-01'::timestamptz,
    ai_summary = NULL;
