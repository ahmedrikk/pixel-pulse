-- Make gaming news articles permanent (never expire).
-- Articles remain in cached_articles indefinitely and are only replaced
-- when a newer article with the same source_url is processed.

-- Allow expires_at to be NULL and default to a far-future date.
ALTER TABLE public.cached_articles
  ALTER COLUMN expires_at DROP NOT NULL,
  ALTER COLUMN expires_at SET DEFAULT '2099-12-31 23:59:59+00'::timestamptz;

-- Backfill any existing rows that still have a real expiry so they never disappear.
UPDATE public.cached_articles
  SET expires_at = '2099-12-31 23:59:59+00'::timestamptz
  WHERE expires_at IS NOT NULL AND expires_at < '2099-01-01 00:00:00+00'::timestamptz;

-- Drop the old index that was only useful for expiration scans.
DROP INDEX IF EXISTS idx_cached_articles_expires_at;

-- Recreate cleanup function so it does NOT touch cached_articles.
CREATE OR REPLACE FUNCTION cleanup_expired_articles()
RETURNS void AS $$
BEGIN
    -- News is permanent; only clean up other expiring tables here if needed.
    -- DELETE FROM public.cached_articles WHERE expires_at < NOW();
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Add a helper index for fast cache-floor checks.
CREATE INDEX IF NOT EXISTS idx_cached_articles_fetched_at
    ON public.cached_articles(fetched_at DESC);

-- Update table documentation.
COMMENT ON TABLE public.cached_articles IS
'Permanent archive of AI-processed gaming news articles. Rows are never deleted by expiry.';
