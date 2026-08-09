-- Pause the game-description backfill without discarding its durable queue.
-- Both the scheduler and manual worker entry point are disabled; completed
-- descriptions and all queued/failed jobs remain available for a later resume.

alter table public.game_description_backfill_runs
  drop constraint if exists game_description_backfill_runs_status_check;

alter table public.game_description_backfill_runs
  add constraint game_description_backfill_runs_status_check
  check (status in ('running', 'paused', 'completed', 'cancelled'));

insert into public.operational_controls (key, enabled, reason, updated_at)
values (
  'game_description_backfill',
  false,
  'Paused by owner request pending review of remaining description work.',
  now()
)
on conflict (key) do update set
  enabled = excluded.enabled,
  reason = excluded.reason,
  updated_at = excluded.updated_at;

insert into public.paused_cron_jobs (job_name, schedule, command, paused_at, reason)
select
  jobname,
  schedule,
  command,
  now(),
  'Game-description backfill paused by owner request.'
from cron.job
where jobname = 'backfill-game-descriptions'
   or command ilike '%/functions/v1/backfill-game-descriptions%'
on conflict (job_name) do update set
  schedule = excluded.schedule,
  command = excluded.command,
  paused_at = excluded.paused_at,
  reason = excluded.reason;

select cron.unschedule(jobid)
from cron.job
where jobname = 'backfill-game-descriptions'
   or command ilike '%/functions/v1/backfill-game-descriptions%';

update public.game_description_backfill_runs
set status = 'paused', updated_at = now(), completed_at = null
where status = 'running';
