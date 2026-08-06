-- Make the owner-requested news pause absolute. The earlier migration stopped
-- known schedulers and Edge Functions; this adds a final database boundary so
-- renamed crons, external workers, or old clients cannot mutate the news cache.

insert into public.operational_controls (key, enabled, reason, updated_at)
values (
  'news_updates',
  false,
  'Hard-frozen by owner request while backend completion is prioritized.',
  now()
)
on conflict (key) do update set
  enabled = excluded.enabled,
  reason = excluded.reason,
  updated_at = excluded.updated_at;

-- Match both known names and destination URLs. This catches a scheduler even
-- if it was recreated under a different name after the first pause.
do $$
declare
  scheduled_job record;
begin
  for scheduled_job in
    select jobid, jobname, schedule, command
    from cron.job
    where jobname in (
      'fetch-gaming-news',
      'guard-news-cache-floor',
      'warm-fetch-news-function',
      'fetch-esports-news',
      'compute-trending-hourly'
    )
    or command ilike '%/functions/v1/fetch-news%'
    or command ilike '%/functions/v1/fetch-esports-news%'
    or command ilike '%/functions/v1/compute-trending%'
  loop
    insert into public.paused_cron_jobs (
      job_name, schedule, command, paused_at, reason
    ) values (
      scheduled_job.jobname,
      scheduled_job.schedule,
      scheduled_job.command,
      now(),
      'Hard news freeze: matched scheduler name or destination URL.'
    )
    on conflict (job_name) do update set
      schedule = excluded.schedule,
      command = excluded.command,
      paused_at = excluded.paused_at,
      reason = excluded.reason;

    perform cron.unschedule(scheduled_job.jobid);
  end loop;
end
$$;

-- News writes are server responsibilities. Remove legacy browser write
-- policies that predated the server-side pipeline.
drop policy if exists "Allow authenticated insert/update" on public.cached_articles;
drop policy if exists "allow_anon_insert" on public.cached_articles;
drop policy if exists "allow_anon_update" on public.cached_articles;

create or replace function public.enforce_news_update_control()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.operational_controls
    where key = 'news_updates' and enabled = false
  ) then
    -- Returning null from a BEFORE trigger cancels the row mutation without
    -- disturbing cached content already visible to readers.
    return null;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_news_update_control on public.cached_articles;
create trigger enforce_news_update_control
before insert or update or delete on public.cached_articles
for each row execute function public.enforce_news_update_control();

comment on function public.enforce_news_update_control() is
  'Cancels cached article mutations while operational_controls.news_updates is disabled.';
