-- A claimed half-hour slot used to be lost permanently when the Edge Function
-- exhausted its resources before marking the run complete. Permit one worker
-- to reclaim an incomplete slot after a short safety window. The daily cap is
-- still calculated from articles actually stored, so recovery cannot exceed
-- the configured daily budget.

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
  claimed_rows integer;
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
  get diagnostics claimed_rows = row_count;

  if claimed_rows = 0 then
    update public.news_pacing_runs run
    set
      configured_allowance = slot_allowance,
      granted_allowance = granted,
      published_count = 0,
      claimed_at = now(),
      completed_at = null
    where run.slot_started_at = slot_key
      and run.completed_at is null
      and run.claimed_at <= now() - interval '2 minutes';
    get diagnostics claimed_rows = row_count;
  end if;

  return query select
    slot_key,
    pacing_band.id,
    pacing_band.band_name,
    slot_allowance,
    case when claimed_rows = 1 then granted else 0 end,
    pacing_settings.daily_budget,
    published_today,
    local_clock::date,
    day_start,
    day_end,
    pacing_settings.timezone_name,
    claimed_rows = 0;
end;
$$;

revoke all on function public.claim_news_pacing_slot(integer, timestamptz) from public;
grant execute on function public.claim_news_pacing_slot(integer, timestamptz) to service_role;

