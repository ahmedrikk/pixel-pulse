-- Calendar releases currently refresh through the existing RAWG browser client
-- and are cached in the canonical games table. Keep the sync-state table ready
-- for a future server-side collector, but do not schedule an unauthenticated
-- worker before its server-only RAWG credential is configured.
select cron.unschedule(jobid)
from cron.job
where jobname = 'fetch-game-calendar';
