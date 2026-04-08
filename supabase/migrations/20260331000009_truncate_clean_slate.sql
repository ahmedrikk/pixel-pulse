-- Clean slate: remove all cached articles (including orphaned old ones).
-- fetch-news will repopulate with fresh 100-word scraped summaries on next run.
TRUNCATE TABLE public.cached_articles RESTART IDENTITY;
