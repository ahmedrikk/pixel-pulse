-- Keep the Free Games collector behind Supabase's JWT gateway. The anon token
-- is public client configuration, but still ensures unsigned requests are
-- rejected before the database-writing function runs.

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fetch-free-games';

select cron.schedule(
  'fetch-free-games',
  '7,37 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-free-games',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
