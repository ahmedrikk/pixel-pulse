-- Expire PCGamer articles so they reprocess with Jina fallback (PCGamer has no RSS descriptions).
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    ai_summary = NULL
WHERE source = 'PCGamer';
