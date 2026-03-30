-- Reprocess with Kimi's comprehensive stripMarkdown() + nav-line filter.
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    ai_title   = NULL,
    ai_summary = NULL;
