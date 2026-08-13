-- Keep Edge Function credentials out of migration text and cron.job commands.
-- The modern server key is provisioned out-of-band in Supabase Vault under
-- `talus_cron_secret_key`; only the postgres role may read it through this
-- security-definer helper.

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.talus_edge_cron_headers()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, vault
as $$
declare
  cron_key text;
begin
  select decrypted_secret
  into cron_key
  from vault.decrypted_secrets
  where name = 'talus_cron_secret_key'
  order by created_at desc
  limit 1;

  if cron_key is null or length(cron_key) < 24 then
    raise exception 'Talus cron credential is not configured in Vault';
  end if;

  return jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', cron_key
  );
end;
$$;

revoke all on function public.talus_edge_cron_headers() from public, anon, authenticated;
grant execute on function public.talus_edge_cron_headers() to postgres, service_role;

do $$
declare
  target_job record;
begin
  for target_job in
    select jobid
    from cron.job
    where jobname in (
      'compute-trending-hourly',
      'ensure-daily-trivia-pool',
      'fetch-free-games',
      'fetch-game-patches',
      'fetch-gaming-news',
      'rewrite-game-patches',
      'warm-fetch-news-function'
    )
  loop
    perform cron.unschedule(target_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'fetch-gaming-news',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-news',
    headers := public.talus_edge_cron_headers(),
    body := '{"trigger":"pg_cron"}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'warm-fetch-news-function',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-news',
    headers := public.talus_edge_cron_headers()
  ) as request_id;
  $$
);

select cron.schedule(
  'compute-trending-hourly',
  '10 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/compute-trending',
    headers := public.talus_edge_cron_headers(),
    body := '{"trigger":"pg_cron"}'::jsonb
  ) as request_id;
  $$
);

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
      url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/generate-trivia',
      headers := public.talus_edge_cron_headers(),
      body := '{}'::jsonb
    )
    else null
  end as request_id;
  $$
);

select cron.schedule(
  'fetch-free-games',
  '7,37 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-free-games',
    headers := public.talus_edge_cron_headers(),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'fetch-game-patches',
  '17,47 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-game-patches',
    headers := public.talus_edge_cron_headers(),
    body := '{"mode":"scheduled"}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'rewrite-game-patches',
  '32 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/rewrite-game-patches',
    headers := public.talus_edge_cron_headers(),
    body := '{"limit":3}'::jsonb
  ) as request_id;
  $$
);
