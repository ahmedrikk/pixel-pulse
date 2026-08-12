-- Repair the latest empty pacing slot from the production worker resource
-- incident. This is deliberately limited to one recent, granted run; normal
-- recovery is handled by claim_news_pacing_slot after this migration.

update public.news_pacing_runs run
set
  completed_at = null,
  claimed_at = now() - interval '3 minutes'
where run.slot_started_at = (
  select candidate.slot_started_at
  from public.news_pacing_runs candidate
  where candidate.slot_started_at >= now() - interval '1 hour'
    and candidate.granted_allowance > 0
    and candidate.published_count = 0
  order by candidate.slot_started_at desc
  limit 1
);

