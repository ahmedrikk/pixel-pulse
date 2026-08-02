-- Talus Game Patch: permanent, source-attributed patch history.

create table if not exists public.game_patch_sources (
  id text primary key,
  game_id text not null references public.games(id) on delete cascade,
  steam_appid integer not null unique,
  source_name text not null default 'Steam Community Announcements',
  active boolean not null default true,
  poll_interval_minutes integer not null default 60 check (poll_interval_minutes >= 15),
  last_polled_at timestamptz,
  backfill_cursor bigint,
  backfill_complete boolean not null default false,
  oldest_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_patches (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id) on delete cascade,
  source_id text not null references public.game_patch_sources(id) on delete cascade,
  external_id text not null,
  title text not null,
  summary text not null default '',
  content_text text not null default '',
  source_url text not null,
  source_name text not null default 'Steam Community Announcements',
  patch_type text not null default 'update'
    check (patch_type in ('patch', 'hotfix', 'balance', 'maintenance', 'update')),
  version_label text,
  image_url text,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create index if not exists game_patches_game_date_idx
  on public.game_patches (game_id, published_at desc);
create index if not exists game_patches_published_idx
  on public.game_patches (published_at desc);
create index if not exists game_patch_sources_due_idx
  on public.game_patch_sources (active, last_polled_at);

alter table public.game_patch_sources enable row level security;
alter table public.game_patches enable row level security;

drop policy if exists "game patch sources are publicly readable" on public.game_patch_sources;
create policy "game patch sources are publicly readable"
  on public.game_patch_sources for select using (true);

drop policy if exists "game patches are publicly readable" on public.game_patches;
create policy "game patches are publicly readable"
  on public.game_patches for select using (true);

drop policy if exists "service role manages game patch sources" on public.game_patch_sources;
create policy "service role manages game patch sources"
  on public.game_patch_sources for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages game patches" on public.game_patches;
create policy "service role manages game patches"
  on public.game_patches for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Older installations do not have games.updated_at.
alter table public.games add column if not exists updated_at timestamptz default now();

-- Seed a focused first-party catalog. Steam artwork is used only when the
-- existing Talus game cache does not already have a cover.
with supported_games(id, name, steam_appid) as (
  values
    ('counter-strike-2', 'Counter-Strike 2', 730),
    ('dota-2', 'Dota 2', 570),
    ('team-fortress-2', 'Team Fortress 2', 440),
    ('pubg-battlegrounds', 'PUBG: BATTLEGROUNDS', 578080),
    ('apex-legends', 'Apex Legends', 1172470),
    ('helldivers-2', 'HELLDIVERS 2', 553850),
    ('cyberpunk-2077', 'Cyberpunk 2077', 1091500),
    ('no-mans-sky', 'No Man''s Sky', 275850),
    ('rust', 'Rust', 252490),
    ('dead-by-daylight', 'Dead by Daylight', 381210),
    ('stardew-valley', 'Stardew Valley', 413150),
    ('terraria', 'Terraria', 105600),
    ('warframe', 'Warframe', 230410),
    ('path-of-exile', 'Path of Exile', 238960),
    ('baldurs-gate-3', 'Baldur''s Gate 3', 1086940),
    ('elden-ring', 'ELDEN RING', 1245620),
    ('palworld', 'Palworld', 1623730),
    ('marvel-rivals', 'Marvel Rivals', 2767030),
    ('the-finals', 'THE FINALS', 2073850),
    ('delta-force', 'Delta Force', 2507950),
    ('destiny-2', 'Destiny 2', 1085660),
    ('rainbow-six-siege', 'Tom Clancy''s Rainbow Six Siege', 359550),
    ('hunt-showdown-1896', 'Hunt: Showdown 1896', 594650),
    ('war-thunder', 'War Thunder', 236390)
)
insert into public.games (
  id, name, slug, cover_image, platforms, steam_appid, expires_at
)
select
  id,
  name,
  id,
  'https://cdn.akamai.steamstatic.com/steam/apps/' || steam_appid || '/header.jpg',
  array['PC']::text[],
  steam_appid,
  now() + interval '365 days'
from supported_games
on conflict (id) do update set
  steam_appid = excluded.steam_appid,
  cover_image = case
    when games.cover_image is null or games.cover_image = ''
      then excluded.cover_image
    else games.cover_image
  end,
  updated_at = now();

with supported_games(id, steam_appid) as (
  values
    ('counter-strike-2', 730), ('dota-2', 570), ('team-fortress-2', 440),
    ('pubg-battlegrounds', 578080), ('apex-legends', 1172470),
    ('helldivers-2', 553850), ('cyberpunk-2077', 1091500),
    ('no-mans-sky', 275850), ('rust', 252490),
    ('dead-by-daylight', 381210), ('stardew-valley', 413150),
    ('terraria', 105600), ('warframe', 230410), ('path-of-exile', 238960),
    ('baldurs-gate-3', 1086940), ('elden-ring', 1245620),
    ('palworld', 1623730), ('marvel-rivals', 2767030),
    ('the-finals', 2073850), ('delta-force', 2507950),
    ('destiny-2', 1085660), ('rainbow-six-siege', 359550),
    ('hunt-showdown-1896', 594650), ('war-thunder', 236390)
)
insert into public.game_patch_sources (id, game_id, steam_appid)
select 'steam-' || steam_appid, id, steam_appid from supported_games
on conflict (id) do update set
  game_id = excluded.game_id,
  steam_appid = excluded.steam_appid,
  active = true,
  updated_at = now();

create or replace function public.get_patch_game_catalog()
returns table (
  game_id text,
  name text,
  cover_image text,
  platforms text[],
  genres text[],
  steam_appid integer,
  patch_count bigint,
  latest_patch_title text,
  latest_patch_type text,
  latest_patch_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    source.game_id,
    game.name,
    game.cover_image,
    coalesce(game.platforms, '{}'::text[]),
    coalesce(game.genres, '{}'::text[]),
    source.steam_appid,
    count(patch.id) as patch_count,
    latest.title as latest_patch_title,
    latest.patch_type as latest_patch_type,
    latest.published_at as latest_patch_at
  from public.game_patch_sources source
  join public.games game on game.id = source.game_id
  left join public.game_patches patch on patch.source_id = source.id
  left join lateral (
    select item.title, item.patch_type, item.published_at
    from public.game_patches item
    where item.source_id = source.id
    order by item.published_at desc
    limit 1
  ) latest on true
  where source.active = true
  group by
    source.game_id, game.name, game.cover_image, game.platforms, game.genres,
    source.steam_appid, latest.title, latest.patch_type, latest.published_at
  order by latest.published_at desc nulls last, game.name;
$$;

revoke all on function public.get_patch_game_catalog() from public;
grant execute on function public.get_patch_game_catalog() to anon, authenticated;

-- Refresh recent updates hourly. Historical backfill proceeds incrementally in
-- the same worker so old patches remain available permanently.
create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fetch-game-patches';

select cron.schedule(
  'fetch-game-patches',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-game-patches',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"mode":"scheduled"}'::jsonb
  ) as request_id;
  $$
);
