-- Pause every automated Talus news refresh while backend completion is the
-- priority. The original schedules are archived verbatim so a later resume is
-- deliberate and reversible instead of relying on memory.

create table if not exists public.operational_controls (
  key text primary key,
  enabled boolean not null default true,
  reason text,
  updated_at timestamptz not null default now()
);

insert into public.operational_controls (key, enabled, reason, updated_at)
values (
  'news_updates',
  false,
  'Paused by owner request while backend completion and API quota auditing are prioritized.',
  now()
)
on conflict (key) do update set
  enabled = excluded.enabled,
  reason = excluded.reason,
  updated_at = excluded.updated_at;

create table if not exists public.paused_cron_jobs (
  job_name text primary key,
  schedule text not null,
  command text not null,
  paused_at timestamptz not null default now(),
  reason text not null
);

insert into public.paused_cron_jobs (job_name, schedule, command, paused_at, reason)
select
  jobname,
  schedule,
  command,
  now(),
  'News updates paused for backend completion and quota audit.'
from cron.job
where jobname in (
  'fetch-gaming-news',
  'guard-news-cache-floor',
  'warm-fetch-news-function',
  'fetch-esports-news',
  'compute-trending-hourly'
)
on conflict (job_name) do update set
  schedule = excluded.schedule,
  command = excluded.command,
  paused_at = excluded.paused_at,
  reason = excluded.reason;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'fetch-gaming-news',
  'guard-news-cache-floor',
  'warm-fetch-news-function',
  'fetch-esports-news',
  'compute-trending-hourly'
);

-- Durable provider-call ledger. It intentionally stores usage metadata and
-- error summaries only—never prompts, source text, API keys, or responses.
create table if not exists public.api_usage_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  provider text not null,
  service text not null,
  model text,
  operation text not null,
  success boolean not null,
  status_code integer,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  cached_tokens integer,
  quota_units integer,
  latency_ms integer not null default 0,
  error_summary text
);

create index if not exists api_usage_events_time_idx
  on public.api_usage_events (occurred_at desc);
create index if not exists api_usage_events_provider_idx
  on public.api_usage_events (provider, service, occurred_at desc);

-- Capture the best historical evidence already present before the pause.
create table if not exists public.backend_api_audit_snapshots (
  id bigint generated always as identity primary key,
  captured_at timestamptz not null default now(),
  report jsonb not null
);

insert into public.backend_api_audit_snapshots (report)
select jsonb_build_object(
  'news_updates_enabled', false,
  'paused_jobs', coalesce((
    select jsonb_agg(jsonb_build_object('name', job_name, 'schedule', schedule) order by job_name)
    from public.paused_cron_jobs
  ), '[]'::jsonb),
  'articles_fetched_last_24h', (
    select count(*) from public.cached_articles where fetched_at >= now() - interval '24 hours'
  ),
  'articles_fetched_last_7d', (
    select count(*) from public.cached_articles where fetched_at >= now() - interval '7 days'
  ),
  'youtube_quota_date', (
    select max(quota_date) from public.youtube_content_sources
  ),
  'youtube_quota_units_today', (
    select coalesce(sum(quota_units_used_today), 0) from public.youtube_content_sources
    where quota_date = current_date
  ),
  'youtube_sources', coalesce((
    select jsonb_agg(jsonb_build_object(
      'source', source_name,
      'active', active,
      'last_polled_at', last_polled_at,
      'quota_date', quota_date,
      'quota_units_today', quota_units_used_today
    ) order by source_name)
    from public.youtube_content_sources
  ), '[]'::jsonb)
);

alter table public.operational_controls enable row level security;
alter table public.paused_cron_jobs enable row level security;
alter table public.api_usage_events enable row level security;
alter table public.backend_api_audit_snapshots enable row level security;

drop policy if exists "operational controls are publicly readable" on public.operational_controls;
create policy "operational controls are publicly readable"
  on public.operational_controls for select using (true);

drop policy if exists "audit snapshots are publicly readable" on public.backend_api_audit_snapshots;
create policy "audit snapshots are publicly readable"
  on public.backend_api_audit_snapshots for select using (true);

create or replace function public.get_api_usage_summary(p_since timestamptz default now() - interval '24 hours')
returns table (
  provider text,
  service text,
  model text,
  operation text,
  requests bigint,
  successes bigint,
  failures bigint,
  prompt_tokens bigint,
  completion_tokens bigint,
  total_tokens bigint,
  quota_units bigint,
  average_latency_ms integer,
  last_request_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    event.provider,
    event.service,
    event.model,
    event.operation,
    count(*)::bigint,
    count(*) filter (where event.success)::bigint,
    count(*) filter (where not event.success)::bigint,
    coalesce(sum(event.prompt_tokens), 0)::bigint,
    coalesce(sum(event.completion_tokens), 0)::bigint,
    coalesce(sum(event.total_tokens), 0)::bigint,
    coalesce(sum(event.quota_units), 0)::bigint,
    coalesce(avg(event.latency_ms), 0)::integer,
    max(event.occurred_at)
  from public.api_usage_events event
  where event.occurred_at >= p_since
  group by event.provider, event.service, event.model, event.operation
  order by max(event.occurred_at) desc;
$$;

revoke all on function public.get_api_usage_summary(timestamptz) from public;
grant execute on function public.get_api_usage_summary(timestamptz) to anon, authenticated, service_role;
