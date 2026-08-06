-- Provider outages are not permanent game failures. Release retryable jobs
-- without consuming their two content-quality attempts, and restore records
-- that were incorrectly exhausted while the worker hid upstream 429 details.

create or replace function public.defer_game_description_backfill_job(
  p_job_id uuid,
  p_attempt_number integer,
  p_error text,
  p_retry_after_seconds integer default 900
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_job public.game_description_backfill_jobs%rowtype;
  bounded_delay integer := least(greatest(coalesce(p_retry_after_seconds, 900), 60), 21600);
begin
  select * into current_job
  from public.game_description_backfill_jobs
  where id = p_job_id
  for update;

  if current_job.id is null
    or current_job.status <> 'processing'
    or current_job.attempts <> p_attempt_number then
    return;
  end if;

  update public.game_description_backfill_jobs
  set status = 'queued',
      attempts = greatest(attempts - 1, 0),
      started_at = null,
      completed_at = null,
      last_error = left('Deferred provider failure: ' || coalesce(p_error, 'unknown'), 500),
      updated_at = now()
  where id = current_job.id;

  update public.games
  set description_status = 'failed', updated_at = now()
  where id = current_job.game_id and description_status = 'generating';

  update public.game_description_backfill_runs
  set status = 'running',
      completed_at = null,
      next_batch_at = greatest(next_batch_at, now() + make_interval(secs => bounded_delay)),
      updated_at = now()
  where id = current_job.run_id;

  perform public.refresh_game_description_backfill_run(current_job.run_id);
end;
$$;

revoke all on function public.defer_game_description_backfill_job(uuid, integer, text, integer) from public;
grant execute on function public.defer_game_description_backfill_job(uuid, integer, text, integer) to service_role;

do $$
declare
  active_run_id uuid;
begin
  select id into active_run_id
  from public.game_description_backfill_runs
  where status in ('running', 'completed')
  order by started_at desc
  limit 1;

  if active_run_id is null then
    return;
  end if;

  update public.game_description_backfill_jobs job
  set status = 'queued',
      attempts = 0,
      started_at = null,
      completed_at = null,
      last_error = 'Requeued after provider-quota retry classification repair.',
      updated_at = now()
  from public.games game
  where job.run_id = active_run_id
    and job.game_id = game.id
    and job.status = 'failed'
    and game.description_status <> 'ready';

  update public.game_description_backfill_runs
  set status = 'running',
      completed_at = null,
      next_batch_at = now() + interval '6 hours',
      updated_at = now()
  where id = active_run_id;

  perform public.refresh_game_description_backfill_run(active_run_id);
end
$$;
