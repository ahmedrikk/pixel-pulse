-- Force reprocess all articles with Qwen QwQ 32B + full article scraping pipeline.
-- Clears ai_title and ai_summary so the pipeline re-fetches and rewrites every article.
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    ai_title   = NULL,
    ai_summary = NULL;
