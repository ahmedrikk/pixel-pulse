-- Fix silently-failing news crons (found during QA F10.5 work, 2026-07-07).
--
-- fetch-news and fetch-esports-news are deployed with verify_jwt enabled, but
-- the pg_cron jobs called them with no Authorization header — every call
-- returned 401 (84 rejections in the 12h before this fix; net._http_response).
-- Articles only refreshed via other authenticated paths.
--
-- Same fix as compute-trending-hourly: send the anon key (public — it ships
-- in the frontend bundle) so the gateway JWT check passes.

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;

-- ── fetch-gaming-news: every 30 minutes ────────────────────────────────────
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'fetch-gaming-news';
select cron.schedule(
  'fetch-gaming-news',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-news',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c"}'::jsonb,
    body    := '{}'::jsonb
  ) as request_id;
  $$
);

-- ── guard-news-cache-floor: every 5 minutes, refill if cache is thin ───────
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'guard-news-cache-floor';
select cron.schedule(
  'guard-news-cache-floor',
  '*/5 * * * *',
  $$
  select case
    when (select count(*) from public.cached_articles) < 10
    then net.http_post(
      url     := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-news',
      headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c"}'::jsonb,
      body    := '{}'::jsonb
    )
    else null
  end as request_id;
  $$
);

-- ── warm-fetch-news-function: every 5 minutes (GET = lightweight health) ────
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'warm-fetch-news-function';
select cron.schedule(
  'warm-fetch-news-function',
  '*/5 * * * *',
  $$
  select net.http_get(
    url     := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-news',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c"}'::jsonb
  ) as request_id;
  $$
);

-- ── fetch-esports-news: hourly ──────────────────────────────────────────────
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'fetch-esports-news';
select cron.schedule(
  'fetch-esports-news',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-esports-news',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c"}'::jsonb,
    body    := '{}'::jsonb
  ) as request_id;
  $$
);
