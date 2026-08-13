-- Check patch sources twice an hour. The worker still enforces each source's
-- own poll_interval_minutes, so this removes schedule drift without doubling
-- Steam requests.

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;
create extension if not exists supabase_vault with schema vault;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fetch-game-patches';

select cron.schedule(
  'fetch-game-patches',
  '17,47 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-game-patches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'talus_cron_secret_key'
        limit 1
      )
    ),
    body := '{"mode":"scheduled"}'::jsonb
  ) as request_id;
  $$
);
