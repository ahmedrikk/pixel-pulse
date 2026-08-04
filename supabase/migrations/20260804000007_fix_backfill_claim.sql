-- Avoid a PL/pgSQL name collision between the RPC's job_id output column and
-- the attempt log's job_id column when recovering a timed-out worker.
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

revoke all on function public.claim_game_description_backfill_jobs(integer) from public;
grant execute on function public.claim_game_description_backfill_jobs(integer) to service_role;
