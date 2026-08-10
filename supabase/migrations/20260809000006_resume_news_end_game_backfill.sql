-- Resume the owner-approved news pipeline and permanently end the one-time
-- game-description backfill. Existing game records and completed descriptions
-- are preserved; only unfinished worker state is cancelled.

insert into public.operational_controls (key, enabled, reason, updated_at)
values (
  'news_updates',
  true,
  'Resumed by owner request after the backend-focused pause.',
  now()
)
on conflict (key) do update set
  enabled = excluded.enabled,
  reason = excluded.reason,
  updated_at = excluded.updated_at;

-- Restore the exact authenticated scheduler definitions captured when news was
-- frozen. This includes the main RSS/YouTube fetch, cache guard, warm-up,
-- esports news, and trending refresh jobs.
do $$
declare
  archived_job record;
begin
  for archived_job in
    select job_name, schedule, command
    from public.paused_cron_jobs
    where job_name in (
      'fetch-gaming-news',
      'guard-news-cache-floor',
      'warm-fetch-news-function',
      'fetch-esports-news',
      'compute-trending-hourly'
    )
  loop
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = archived_job.job_name;

    perform cron.schedule(
      archived_job.job_name,
      archived_job.schedule,
      archived_job.command
    );
  end loop;
end
$$;

insert into public.operational_controls (key, enabled, reason, updated_at)
values (
  'game_description_backfill',
  false,
  'Ended by owner request. The one-time game-entry backfill must not resume.',
  now()
)
on conflict (key) do update set
  enabled = excluded.enabled,
  reason = excluded.reason,
  updated_at = excluded.updated_at;

-- Remove any recreated or renamed worker schedule before finalizing state.
do $$
declare
  worker_job record;
begin
  for worker_job in
    select jobid
    from cron.job
    where jobname = 'backfill-game-descriptions'
       or command ilike '%/functions/v1/backfill-game-descriptions%'
  loop
    perform cron.unschedule(worker_job.jobid);
  end loop;
end
$$;

alter table public.game_description_backfill_jobs
  drop constraint if exists game_description_backfill_jobs_status_check;

alter table public.game_description_backfill_jobs
  add constraint game_description_backfill_jobs_status_check
  check (status in ('queued', 'processing', 'succeeded', 'failed', 'cancelled'));

update public.game_description_backfill_jobs
set
  status = 'cancelled',
  completed_at = coalesce(completed_at, now()),
  last_error = coalesce(last_error, 'Backfill ended by owner request.'),
  updated_at = now()
where status in ('queued', 'processing');

update public.games game
set description_status = 'missing', updated_at = now()
where game.description_status = 'generating'
  and exists (
    select 1
    from public.game_description_backfill_jobs job
    where job.game_id = game.id and job.status = 'cancelled'
  );

update public.game_description_backfill_runs
set
  status = 'cancelled',
  completed_at = coalesce(completed_at, now()),
  updated_at = now()
where status in ('running', 'paused');

-- Start one fresh run immediately rather than waiting for the next half-hour.
-- The archived command already contains the authenticated Edge Function call.
do $$
declare
  immediate_command text;
begin
  select command into immediate_command
  from public.paused_cron_jobs
  where job_name = 'fetch-gaming-news';

  if immediate_command is not null then
    execute immediate_command;
  end if;
end
$$;
