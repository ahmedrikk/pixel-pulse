-- Enable pg_cron extension (requires superuser; enable via Supabase Dashboard if this fails:
-- Dashboard → Database → Extensions → pg_cron → Enable)
create extension if not exists pg_cron schema pg_catalog;

-- Schedule fetch-esports-news edge function every hour via pg_cron + pg_net.
-- The function runs fully server-side: RSS → cached_articles.
-- verify_jwt is disabled on the function (deployed with --no-verify-jwt).
select cron.schedule(
  'fetch-esports-news',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-esports-news',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) as request_id;
  $$
);
