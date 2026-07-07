-- Schedule compute-trending hourly via pg_cron + pg_net.
-- Vercel Hobby only allows daily cron jobs (deploys were failing with
-- "Hobby accounts are limited to daily cron jobs"), so scheduling lives here —
-- same fix as 446e8b8 applied to fetch-news. The Vercel crons are removed
-- from vercel.json; /api/cron/* remain as manual trigger endpoints.
create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;

-- compute-trending is deployed with verify_jwt enabled, so pass the anon key
-- (it is public — the same key ships in the frontend bundle).
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'compute-trending-hourly';
select cron.schedule(
  'compute-trending-hourly',
  '10 * * * *',  -- minute 10, after fetch-news (:00/:30) lands fresh articles
  $$
  select net.http_post(
    url     := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/compute-trending',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c"}'::jsonb,
    body    := '{"trigger":"pg_cron"}'::jsonb
  ) as request_id;
  $$
);
