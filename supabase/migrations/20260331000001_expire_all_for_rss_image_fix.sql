-- Expire all articles to reprocess with media:content image extraction
-- and removal of Jina dependency.
UPDATE public.cached_articles
SET expires_at = '2000-01-01',
    image_url  = '',
    og_image_url = NULL,
    ai_summary = NULL;
