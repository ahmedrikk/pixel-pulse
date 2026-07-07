-- Harden the news-ingestion cron so it keeps the cache full independently of users.
-- 1. Ensure required extensions are enabled.
-- 2. Keep the 30-minute fetch-news schedule.
-- 3. Add a cache-floor check that triggers an immediate refill if articles drop low.
-- 4. Add a lightweight keep-alive ping so the edge function stays warm.

-- Enable cron and HTTP extensions (may require Superuser / Dashboard on some tiers).
create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;

-- ============================================================================
-- Main ingestion job: refresh news every 30 minutes.
-- ============================================================================
select cron.unschedule('fetch-gaming-news');
select cron.schedule(
  'fetch-gaming-news',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-news',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) as request_id;
  $$
);

-- ============================================================================
-- Cache-floor guard: if cached_articles ever drops below 10, trigger fetch-news
-- immediately (runs every 5 minutes). This guarantees users always see news.
-- ============================================================================
select cron.unschedule('guard-news-cache-floor');
select cron.schedule(
  'guard-news-cache-floor',
  '*/5 * * * *',
  $$
  select case
    when (select count(*) from public.cached_articles) < 10
    then net.http_post(
      url     := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-news',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    )
    else null
  end as request_id;
  $$
);

-- ============================================================================
-- Keep-alive ping: hit the edge function every 5 minutes with a tiny request
-- so the function container stays warm and cold starts disappear.
-- ============================================================================
select cron.unschedule('warm-fetch-news-function');
select cron.schedule(
  'warm-fetch-news-function',
  '*/5 * * * *',
  $$
  select net.http_get(
    url     := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-news',
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) as request_id;
  $$
);
