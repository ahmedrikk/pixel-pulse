-- Keep the Free Games collector behind Supabase's JWT gateway. The anon token
-- is public client configuration, but still ensures unsigned requests are
-- rejected before the database-writing function runs.

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;
create extension if not exists supabase_vault with schema vault;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fetch-free-games';

select cron.schedule(
  'fetch-free-games',
  '7,37 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-free-games',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'talus_cron_secret_key'
        limit 1
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
