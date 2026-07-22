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
      headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c"}'::jsonb,
      body    := '{}'::jsonb
    )
    else null
  end as request_id;
  $$
);
