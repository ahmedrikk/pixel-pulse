-- Keep the public daily-trivia pool populated independently of page visits.
-- The key below is the project's public legacy anon JWT (already shipped in
-- earlier cron migrations), used only to pass Edge gateway verification.

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;

select cron.unschedule(j.jobid)
from cron.job j
where j.jobname = 'ensure-daily-trivia-pool';

select cron.schedule(
  'ensure-daily-trivia-pool',
  '10 * * * *',
  $$
  select case
    when (
      select count(*)
      from public.trivia_questions
      where expires_at > now()
    ) < 5
    then net.http_post(
      url     := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/generate-trivia',
      headers := '{"Content-Type": "application/json", "apikey": "<redacted-credential>", "Authorization": "Bearer <redacted-credential>"}'::jsonb,
      body    := '{}'::jsonb
    )
    else null
  end as request_id;
  $$
);
