-- Talus Free Games: current giveaways plus a permanent expired-offer archive.

create table if not exists public.free_game_offers (
  id uuid primary key default gen_random_uuid(),
  source_name text not null default 'GamerPower',
  external_id text not null,
  title text not null,
  description text not null default '',
  instructions text not null default '',
  image_url text,
  thumbnail_url text,
  offer_url text not null,
  source_url text not null,
  store_name text not null default 'Other',
  platforms text[] not null default '{}'::text[],
  offer_kind text not null default 'keep'
    check (offer_kind in ('keep', 'timed', 'other')),
  worth_text text,
  users_count integer not null default 0,
  published_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'expired')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_name, external_id)
);

create index if not exists free_game_offers_active_end_idx
  on public.free_game_offers (status, ends_at nulls last);
create index if not exists free_game_offers_published_idx
  on public.free_game_offers (published_at desc);
create index if not exists free_game_offers_store_idx
  on public.free_game_offers (store_name, status);

alter table public.free_game_offers enable row level security;

drop policy if exists "free game offers are publicly readable" on public.free_game_offers;
create policy "free game offers are publicly readable"
  on public.free_game_offers for select using (true);

drop policy if exists "service role manages free game offers" on public.free_game_offers;
create policy "service role manages free game offers"
  on public.free_game_offers for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fetch-free-games';

-- GamerPower's feed is small and intended for public integrations. A
-- half-hour refresh keeps expiring offers accurate without excessive polling.
select cron.schedule(
  'fetch-free-games',
  '7,37 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-free-games',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
