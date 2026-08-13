-- Confirmed game releases reuse the canonical public.games table. This table
-- stores only collector freshness, never a second copy of game metadata.
create table if not exists public.game_calendar_syncs (
  month_start date primary key,
  synced_at timestamptz not null default now(),
  game_count integer not null default 0 check (game_count >= 0)
);
alter table public.game_calendar_syncs enable row level security;

create index if not exists games_release_date_idx
  on public.games (release_date)
  where release_date ~ '^\d{4}-\d{2}-\d{2}$';

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;
create extension if not exists supabase_vault with schema vault;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fetch-game-calendar';

select cron.schedule(
  'fetch-game-calendar',
  '17 9 * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-game-calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'talus_cron_secret_key'
        limit 1
      )
    ),
    body := '{"monthsAhead":12}'::jsonb
  ) as request_id;
  $$
);
