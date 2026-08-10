-- Check patch sources twice an hour. The worker still enforces each source's
-- own poll_interval_minutes, so this removes schedule drift without doubling
-- Steam requests.

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fetch-game-patches';

select cron.schedule(
  'fetch-game-patches',
  '17,47 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-game-patches',
    headers := '{"Content-Type":"application/json","apikey":"<redacted-credential>","Authorization":"Bearer <redacted-credential>"}'::jsonb,
    body := '{"mode":"scheduled"}'::jsonb
  ) as request_id;
  $$
);
