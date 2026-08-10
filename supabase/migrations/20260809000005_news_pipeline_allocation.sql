-- Talus news pipeline v1.1
-- RSS articles share a 100-card daily budget. YouTube sources are configured
-- separately and intentionally do not consume this quota.

create table if not exists public.news_rss_sources (
  id text primary key,
  source_name text not null unique,
  rss_url text not null unique,
  daily_quota integer not null default 0 check (daily_quota >= 0),
  min_quota integer not null default 0 check (min_quota >= 0),
  max_quota integer not null default 0 check (max_quota >= daily_quota),
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.news_rss_sources is
  'Editable RSS source registry and daily allocation limits. YouTube is not included in the RSS article cap.';

create index if not exists news_rss_sources_active_order_idx
  on public.news_rss_sources (active, display_order);

alter table public.news_rss_sources enable row level security;

insert into public.news_rss_sources
  (id, source_name, rss_url, daily_quota, min_quota, max_quota, active, display_order)
values
  ('ign', 'IGN', 'https://www.ign.com/rss/articles/feed?tags=news', 5, 2, 8, true, 10),
  ('gamespot', 'GameSpot', 'https://www.gamespot.com/feeds/news/', 5, 2, 8, true, 20),
  ('kotaku', 'Kotaku', 'https://kotaku.com/feed', 5, 2, 8, true, 30),
  ('polygon', 'Polygon', 'https://www.polygon.com/rss/index.xml', 5, 2, 8, true, 40),
  ('dexerto-twitch', 'Dexerto Twitch', 'https://www.dexerto.com/twitch/feed/', 5, 2, 8, true, 50),
  ('game-developer', 'Game Developer', 'https://www.gamedeveloper.com/rss.xml', 5, 2, 8, true, 60),
  ('pc-gamer', 'PCGamer', 'https://www.pcgamer.com/rss/', 5, 2, 8, true, 70),
  ('gematsu', 'Gematsu', 'https://www.gematsu.com/feed', 5, 2, 8, true, 80),
  ('vg247', 'VG247', 'https://www.vg247.com/feed', 5, 2, 8, true, 90),
  ('game-informer', 'Game Informer', 'https://gameinformer.com/rss.xml', 5, 2, 8, true, 100),
  ('wccftech', 'WCCFtech', 'https://wccftech.com/topic/games/feed/', 5, 2, 8, true, 110),
  ('gamesradar', 'GamesRadar', 'https://www.gamesradar.com/feeds/articles/rss/', 5, 2, 8, true, 120),
  ('eurogamer', 'Eurogamer', 'https://www.eurogamer.net/feed', 5, 2, 8, true, 130),
  ('rock-paper-shotgun', 'Rock Paper Shotgun', 'https://www.rockpapershotgun.com/feed', 5, 2, 8, true, 140),
  ('destructoid', 'Destructoid', 'https://www.destructoid.com/feed/', 5, 2, 8, true, 150),
  ('siliconera', 'Siliconera', 'https://www.siliconera.com/feed/', 5, 2, 8, true, 160),
  ('nintendo-life', 'Nintendo Life', 'https://www.nintendolife.com/feeds/latest', 4, 2, 7, true, 170),
  ('push-square', 'Push Square', 'https://www.pushsquare.com/feeds/latest', 4, 2, 7, true, 180),
  ('dot-esports', 'Dot Esports', 'https://dotesports.com/feed', 4, 2, 7, true, 190),
  ('gamesindustry', 'GamesIndustry.biz', 'https://www.gamesindustry.biz/feed', 4, 2, 7, true, 200),
  ('game-rant', 'Game Rant', 'https://gamerant.com/feed/', 4, 2, 7, true, 210)
on conflict (id) do update set
  source_name = excluded.source_name,
  rss_url = excluded.rss_url,
  daily_quota = excluded.daily_quota,
  min_quota = excluded.min_quota,
  max_quota = excluded.max_quota,
  active = excluded.active,
  display_order = excluded.display_order,
  updated_at = now();

create table if not exists public.news_source_daily_usage (
  run_date date not null,
  source_id text not null references public.news_rss_sources(id) on update cascade on delete restrict,
  source_name text not null,
  fetched_count integer not null default 0 check (fetched_count >= 0),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  allocated_count integer not null default 0 check (allocated_count >= 0),
  published_count integer not null default 0 check (published_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  near_miss_count integer not null default 0 check (near_miss_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (run_date, source_id)
);

comment on table public.news_source_daily_usage is
  'Daily RSS fetch, dedupe, allocation, and publication counters for pipeline monitoring.';

create index if not exists news_source_daily_usage_source_date_idx
  on public.news_source_daily_usage (source_id, run_date desc);

alter table public.news_source_daily_usage enable row level security;
