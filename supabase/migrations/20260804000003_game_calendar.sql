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

select cron.unschedule(jobid)
from cron.job
where jobname = 'fetch-game-calendar';

select cron.schedule(
  'fetch-game-calendar',
  '17 9 * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-game-calendar',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Y3Fxc3Zpd3R3eHVraXppYmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzE1NjksImV4cCI6MjA4NzQ0NzU2OX0.3oP-JZE5oPovLVLjXvgz5C05ybFBfpgZPwf50d5F02c"}'::jsonb,
    body := '{"monthsAhead":12}'::jsonb
  ) as request_id;
  $$
);
