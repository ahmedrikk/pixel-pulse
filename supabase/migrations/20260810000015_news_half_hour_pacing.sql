-- Talus news timing v1.0: configurable time bands, one claim per half-hour
-- slot, no token rollover, and durable per-source discovery checkpoints.

alter table public.news_rss_sources
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_article_url text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_successful_check_at timestamptz,
  add column if not exists last_check_error text;

create table if not exists public.news_source_candidates (
  id bigint generated always as identity primary key,
  source_id text not null references public.news_rss_sources(id) on update cascade on delete cascade,
  source_name text not null,
  source_url text not null unique,
  title text not null,
  published_at timestamptz not null,
  author text,
  description text,
  enclosure_url text,
  status text not null default 'pending'
    check (status in ('pending', 'published', 'duplicate', 'expired')),
  discovered_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists news_source_candidates_pending_idx
  on public.news_source_candidates (status, published_at, source_id);

alter table public.news_source_candidates enable row level security;
revoke all on public.news_source_candidates from anon, authenticated;

create table if not exists public.news_pacing_settings (
  singleton boolean primary key default true check (singleton),
  daily_budget integer not null default 100 check (daily_budget > 0),
  run_frequency_minutes integer not null default 30
    check (run_frequency_minutes > 0 and run_frequency_minutes <= 60),
  timezone_name text not null default 'America/Chicago',
  updated_at timestamptz not null default now()
);

insert into public.news_pacing_settings
  (singleton, daily_budget, run_frequency_minutes, timezone_name)
values (true, 100, 30, 'America/Chicago')
on conflict (singleton) do nothing;

create table if not exists public.news_pacing_bands (
  id text primary key,
  band_name text not null,
  start_minute integer not null check (start_minute >= 0 and start_minute < 1440),
  end_minute integer not null check (end_minute > 0 and end_minute <= 1440),
  budget_share numeric(5,2) not null check (budget_share >= 0 and budget_share <= 100),
  display_order integer not null,
  updated_at timestamptz not null default now(),
  check (end_minute > start_minute)
);

insert into public.news_pacing_bands
  (id, band_name, start_minute, end_minute, budget_share, display_order)
values
  ('overnight', 'Overnight', 0, 360, 10, 10),
  ('morning', 'Morning', 360, 660, 30, 20),
  ('midday', 'Midday / afternoon', 660, 1020, 35, 30),
  ('evening', 'Evening', 1020, 1440, 25, 40)
on conflict (id) do update set
  band_name = excluded.band_name,
  start_minute = excluded.start_minute,
  end_minute = excluded.end_minute,
  budget_share = excluded.budget_share,
  display_order = excluded.display_order,
  updated_at = now();

alter table public.news_pacing_settings enable row level security;
alter table public.news_pacing_bands enable row level security;
revoke all on public.news_pacing_settings from anon, authenticated;
revoke all on public.news_pacing_bands from anon, authenticated;

create table if not exists public.news_pacing_runs (
  slot_started_at timestamptz primary key,
  local_date date not null,
  timezone_name text not null,
  band_id text not null references public.news_pacing_bands(id) on update cascade,
  configured_allowance integer not null check (configured_allowance >= 0),
  granted_allowance integer not null check (granted_allowance >= 0),
  published_count integer not null default 0 check (published_count >= 0),
  claimed_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists news_pacing_runs_local_day_idx
  on public.news_pacing_runs (local_date, slot_started_at);

alter table public.news_pacing_runs enable row level security;
revoke all on public.news_pacing_runs from anon, authenticated;

create or replace function public.claim_news_pacing_slot(
  p_requested integer,
  p_now timestamptz default now()
)
returns table (
  slot_started_at timestamptz,
  band_id text,
  band_name text,
  configured_allowance integer,
  granted_allowance integer,
  daily_budget integer,
  daily_published_before integer,
  local_date date,
  local_day_start timestamptz,
  local_day_end timestamptz,
  timezone_name text,
  already_claimed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  pacing_settings public.news_pacing_settings%rowtype;
  pacing_band public.news_pacing_bands%rowtype;
  local_clock timestamp;
  minute_of_day integer;
  slot_count integer;
  slot_index integer;
  band_budget integer;
  slot_allowance integer;
  slot_key timestamptz;
  day_start timestamptz;
  day_end timestamptz;
  published_today integer;
  daily_room integer;
  granted integer;
  inserted_rows integer;
begin
  select settings.* into pacing_settings
  from public.news_pacing_settings settings
  where settings.singleton = true;

  if not found then
    raise exception 'News pacing settings are not configured';
  end if;
  if (select coalesce(sum(budget_share), 0) from public.news_pacing_bands) <> 100 then
    raise exception 'News pacing band shares must total 100';
  end if;

  local_clock := p_now at time zone pacing_settings.timezone_name;
  minute_of_day := extract(hour from local_clock)::integer * 60
    + extract(minute from local_clock)::integer;

  select band.* into pacing_band
  from public.news_pacing_bands band
  where minute_of_day >= band.start_minute
    and minute_of_day < band.end_minute
  order by band.display_order
  limit 1;

  if not found then
    raise exception 'No news pacing band covers local minute %', minute_of_day;
  end if;
  if mod(pacing_band.end_minute - pacing_band.start_minute, pacing_settings.run_frequency_minutes) <> 0 then
    raise exception 'Band % duration must be divisible by the run frequency', pacing_band.id;
  end if;

  slot_count := (pacing_band.end_minute - pacing_band.start_minute)
    / pacing_settings.run_frequency_minutes;
  slot_index := floor(
    (minute_of_day - pacing_band.start_minute)::numeric
    / pacing_settings.run_frequency_minutes
  )::integer;
  band_budget := round(pacing_settings.daily_budget * pacing_band.budget_share / 100.0);
  slot_allowance := floor((slot_index + 1)::numeric * band_budget / slot_count)::integer
    - floor(slot_index::numeric * band_budget / slot_count)::integer;

  slot_key := to_timestamp(
    floor(extract(epoch from p_now) / (pacing_settings.run_frequency_minutes * 60))
      * (pacing_settings.run_frequency_minutes * 60)
  );
  day_start := local_clock::date::timestamp at time zone pacing_settings.timezone_name;
  day_end := (local_clock::date + 1)::timestamp at time zone pacing_settings.timezone_name;

  select count(*)::integer into published_today
  from public.cached_articles article
  where article.media_type = 'article'
    and article.fetched_at >= day_start
    and article.fetched_at < day_end
    and article.source in (select source_name from public.news_rss_sources);

  daily_room := greatest(0, pacing_settings.daily_budget - published_today);
  granted := least(
    greatest(0, coalesce(p_requested, 0)),
    greatest(0, slot_allowance),
    daily_room
  );

  insert into public.news_pacing_runs (
    slot_started_at,
    local_date,
    timezone_name,
    band_id,
    configured_allowance,
    granted_allowance
  ) values (
    slot_key,
    local_clock::date,
    pacing_settings.timezone_name,
    pacing_band.id,
    slot_allowance,
    granted
  )
  on conflict on constraint news_pacing_runs_pkey do nothing;
  get diagnostics inserted_rows = row_count;

  return query select
    slot_key,
    pacing_band.id,
    pacing_band.band_name,
    slot_allowance,
    case when inserted_rows = 1 then granted else 0 end,
    pacing_settings.daily_budget,
    published_today,
    local_clock::date,
    day_start,
    day_end,
    pacing_settings.timezone_name,
    inserted_rows = 0;
end;
$$;

revoke all on function public.claim_news_pacing_slot(integer, timestamptz) from public;
grant execute on function public.claim_news_pacing_slot(integer, timestamptz) to service_role;

comment on table public.news_ingestion_budget is
  'Deprecated token-bucket pacing state. Retained for migration history; fetch-news now uses news_pacing_settings, news_pacing_bands, and news_pacing_runs.';

-- Keep exactly one mutating fetch-news schedule, every 30 minutes. The warm
-- GET remains harmless; the five-minute cache guard is removed because it can
-- create out-of-band publishing runs.
do $$
declare
  fetch_command text;
  target_job record;
begin
  select command into fetch_command
  from cron.job
  where jobname = 'fetch-gaming-news'
  order by jobid desc
  limit 1;

  if fetch_command is null then
    select command into fetch_command
    from public.paused_cron_jobs
    where job_name = 'fetch-gaming-news'
    limit 1;
  end if;

  if fetch_command is null then
    raise exception 'Cannot restore fetch-gaming-news: scheduler command is missing';
  end if;

  for target_job in
    select jobid
    from cron.job
    where jobname in ('fetch-gaming-news', 'guard-news-cache-floor')
      or (command ilike '%net.http_post%/functions/v1/fetch-news%')
  loop
    perform cron.unschedule(target_job.jobid);
  end loop;

  perform cron.schedule('fetch-gaming-news', '*/30 * * * *', fetch_command);
end
$$;

delete from public.paused_cron_jobs
where job_name = 'guard-news-cache-floor';
