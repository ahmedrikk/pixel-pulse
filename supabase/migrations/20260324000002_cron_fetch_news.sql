-- Enable pg_cron extension (requires superuser; enable via Supabase Dashboard if this fails:
-- Dashboard → Database → Extensions → pg_cron → Enable)
create extension if not exists pg_cron schema pg_catalog;

-- Schedule fetch-news edge function every 30 minutes via pg_cron + pg_net.
-- The function runs fully server-side: RSS → Jina AI → Groq → cached_articles.
-- verify_jwt is disabled on the function (deployed with --no-verify-jwt).
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
