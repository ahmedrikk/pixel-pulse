-- Durable, throttled pre-launch description backfill with an auditable log.
create table if not exists public.game_description_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running', 'completed', 'cancelled')),
  total_target integer not null default 0,
  processed integer not null default 0,
  succeeded integer not null default 0,
  failed integer not null default 0,
  batch_size integer not null default 3 check (batch_size between 1 and 5),
  next_batch_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.game_description_backfill_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.game_description_backfill_runs(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'succeeded', 'failed')),
  attempts integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  word_count integer,
  updated_at timestamptz not null default now(),
  unique (run_id, game_id)
);

create table if not exists public.game_description_backfill_attempts (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.game_description_backfill_runs(id) on delete cascade,
  job_id uuid not null references public.game_description_backfill_jobs(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  attempt_number integer not null,
  status text not null check (status in ('succeeded', 'failed')),
  word_count integer,
  duration_ms integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  unique (job_id, attempt_number)
);

create index if not exists game_description_backfill_jobs_queue_idx
  on public.game_description_backfill_jobs (run_id, status, updated_at);
create index if not exists game_description_backfill_attempts_recent_idx
  on public.game_description_backfill_attempts (run_id, created_at desc);

alter table public.game_description_backfill_runs enable row level security;
alter table public.game_description_backfill_jobs enable row level security;
alter table public.game_description_backfill_attempts enable row level security;

drop policy if exists "backfill progress is publicly readable" on public.game_description_backfill_runs;
create policy "backfill progress is publicly readable"
  on public.game_description_backfill_runs for select using (true);
drop policy if exists "backfill jobs are publicly readable" on public.game_description_backfill_jobs;
create policy "backfill jobs are publicly readable"
  on public.game_description_backfill_jobs for select using (true);
drop policy if exists "backfill attempts are publicly readable" on public.game_description_backfill_attempts;
create policy "backfill attempts are publicly readable"
  on public.game_description_backfill_attempts for select using (true);

create or replace function public.refresh_game_description_backfill_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  queued_count integer;
  processing_count integer;
  success_count integer;
  failure_count integer;
begin
  select
    count(*) filter (where status = 'queued'),
    count(*) filter (where status = 'processing'),
    count(*) filter (where status = 'succeeded'),
    count(*) filter (where status = 'failed')
  into queued_count, processing_count, success_count, failure_count
  from public.game_description_backfill_jobs
  where run_id = p_run_id;

  update public.game_description_backfill_runs
  set
    processed = success_count + failure_count,
    succeeded = success_count,
    failed = failure_count,
    status = case when queued_count = 0 and processing_count = 0 then 'completed' else status end,
    completed_at = case when queued_count = 0 and processing_count = 0 then coalesce(completed_at, now()) else null end,
    updated_at = now()
  where id = p_run_id;
end;
$$;

create or replace function public.claim_game_description_backfill_jobs(p_limit integer default 3)
returns table (
  run_id uuid,
  job_id uuid,
  game_id text,
  attempt_number integer,
  name text,
  developer text,
  publisher text,
  release_date text,
  genres text[],
  platforms text[],
  source_summary text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_run public.game_description_backfill_runs%rowtype;
begin
  select * into active_run
  from public.game_description_backfill_runs
  where status = 'running'
  order by started_at desc
  limit 1
  for update skip locked;

  if active_run.id is null or active_run.next_batch_at > now() then
    return;
  end if;

  insert into public.game_description_backfill_attempts (
    run_id, job_id, game_id, attempt_number, status, duration_ms, error
  )
  select
    job.run_id, job.id, job.game_id, job.attempts, 'failed',
    greatest(0, (extract(epoch from (now() - job.started_at)) * 1000)::integer),
    'Worker heartbeat expired; the job was returned to the queue.'
  from public.game_description_backfill_jobs job
  where job.run_id = active_run.id
    and job.status = 'processing'
    and job.started_at < now() - interval '20 minutes'
  on conflict on constraint game_description_backfill_attempts_job_id_attempt_number_key do nothing;

  update public.games game
  set description_status = 'failed', updated_at = now()
  from public.game_description_backfill_jobs job
  where job.run_id = active_run.id
    and job.game_id = game.id
    and job.status = 'processing'
    and job.started_at < now() - interval '20 minutes'
    and game.description_status = 'generating';

  update public.game_description_backfill_jobs job
  set
    status = case when attempts < 2 then 'queued' else 'failed' end,
    completed_at = case when attempts < 2 then null else now() end,
    last_error = 'Worker heartbeat expired.',
    updated_at = now()
  where job.run_id = active_run.id
    and job.status = 'processing'
    and job.started_at < now() - interval '20 minutes';

  update public.game_description_backfill_runs
  set next_batch_at = now() + interval '5 minutes', updated_at = now()
  where id = active_run.id;

  return query
  with candidates as (
    select job.id
    from public.game_description_backfill_jobs job
    join public.games game on game.id = job.game_id
    where job.run_id = active_run.id and job.status = 'queued'
    order by game.review_count desc, game.free_now desc, game.trending desc nulls last, job.updated_at, job.game_id
    limit greatest(1, least(coalesce(p_limit, active_run.batch_size), 5))
    for update of job skip locked
  ), claimed as (
    update public.game_description_backfill_jobs job
    set status = 'processing', attempts = attempts + 1, started_at = now(), completed_at = null,
        last_error = null, updated_at = now()
    from candidates
    where job.id = candidates.id
    returning job.*
  ), marked as (
    update public.games game
    set description_status = 'generating', updated_at = now()
    from claimed
    where game.id = claimed.game_id
    returning game.id
  )
  select
    claimed.run_id,
    claimed.id,
    game.id,
    claimed.attempts,
    game.name,
    game.developer,
    game.publisher,
    game.release_date,
    coalesce(game.genres, '{}'::text[]),
    coalesce(game.platforms, '{}'::text[]),
    left(coalesce(game.description, ''), 7000)
  from claimed
  join public.games game on game.id = claimed.game_id
  join marked on marked.id = game.id;

  perform public.refresh_game_description_backfill_run(active_run.id);
end;
$$;

create or replace function public.record_game_description_backfill_result(
  p_job_id uuid,
  p_attempt_number integer,
  p_success boolean,
  p_word_count integer default null,
  p_duration_ms integer default 0,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_job public.game_description_backfill_jobs%rowtype;
begin
  select * into current_job
  from public.game_description_backfill_jobs
  where id = p_job_id
  for update;

  if current_job.id is null or current_job.attempts <> p_attempt_number then
    return;
  end if;

  insert into public.game_description_backfill_attempts (
    run_id, job_id, game_id, attempt_number, status, word_count, duration_ms, error
  ) values (
    current_job.run_id, current_job.id, current_job.game_id, p_attempt_number,
    case when p_success then 'succeeded' else 'failed' end,
    p_word_count, greatest(0, coalesce(p_duration_ms, 0)), left(p_error, 500)
  )
  on conflict (job_id, attempt_number) do update set
    status = excluded.status,
    word_count = excluded.word_count,
    duration_ms = excluded.duration_ms,
    error = excluded.error,
    created_at = now();

  if p_success then
    update public.game_description_backfill_jobs
    set status = 'succeeded', completed_at = now(), word_count = p_word_count,
        last_error = null, updated_at = now()
    where id = p_job_id;
  elsif current_job.attempts < 2 then
    update public.game_description_backfill_jobs
    set status = 'queued', started_at = null, completed_at = null,
        last_error = left(p_error, 500), updated_at = now()
    where id = p_job_id;
    update public.games set description_status = 'failed', updated_at = now()
    where id = current_job.game_id and description_status = 'generating';
  else
    update public.game_description_backfill_jobs
    set status = 'failed', completed_at = now(), last_error = left(p_error, 500), updated_at = now()
    where id = p_job_id;
    update public.games set description_status = 'failed', updated_at = now()
    where id = current_job.game_id and description_status = 'generating';
  end if;

  perform public.refresh_game_description_backfill_run(current_job.run_id);
end;
$$;

revoke all on function public.claim_game_description_backfill_jobs(integer) from public;
revoke all on function public.record_game_description_backfill_result(uuid, integer, boolean, integer, integer, text) from public;
revoke all on function public.refresh_game_description_backfill_run(uuid) from public;
grant execute on function public.claim_game_description_backfill_jobs(integer) to service_role;
grant execute on function public.record_game_description_backfill_result(uuid, integer, boolean, integer, integer, text) to service_role;
grant execute on function public.refresh_game_description_backfill_run(uuid) to service_role;

-- Restart any abandoned on-demand jobs, cancel an older backfill, and create
-- one frozen queue for tonight's run so progress percentages stay meaningful.
do $$
declare
  new_run_id uuid;
  target_count integer;
begin
  update public.game_description_backfill_runs
  set status = 'cancelled', completed_at = now(), updated_at = now()
  where status = 'running';

  update public.games
  set description_status = 'failed', updated_at = now()
  where description_status = 'generating' and updated_at < now() - interval '20 minutes';

  insert into public.game_description_backfill_runs (status, batch_size)
  values ('running', 3)
  returning id into new_run_id;

  insert into public.game_description_backfill_jobs (run_id, game_id)
  select new_run_id, game.id
  from public.games game
  where game.description_status in ('missing', 'legacy', 'failed')
  order by game.review_count desc, game.free_now desc, game.trending desc nulls last, game.id;

  select count(*) into target_count
  from public.game_description_backfill_jobs
  where run_id = new_run_id;

  update public.game_description_backfill_runs
  set total_target = target_count,
      status = case when target_count = 0 then 'completed' else 'running' end,
      completed_at = case when target_count = 0 then now() else null end,
      updated_at = now()
  where id = new_run_id;
end;
$$;

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;
create extension if not exists supabase_vault with schema vault;

select cron.unschedule(jobid)
from cron.job
where jobname = 'backfill-game-descriptions';

select cron.schedule(
  'backfill-game-descriptions',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/backfill-game-descriptions',
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
