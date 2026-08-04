-- Atomically claim a bounded description-enrichment batch. This keeps the
-- recurring Free Games worker from generating the same Game description twice
-- when runs overlap, and prevents client-side mutation limits being ignored.
create or replace function public.claim_game_description_jobs(candidate_ids text[], limit_count integer default 3)
returns table (game_id text)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select game.id
    from public.games game
    where game.description_status in ('missing', 'failed')
      and game.id = any(coalesce(candidate_ids, '{}'::text[]))
    order by game.free_now desc, game.updated_at asc, game.id
    limit greatest(1, least(coalesce(limit_count, 3), 10))
    for update skip locked
  ), claimed as (
    update public.games game
    set description_status = 'generating', updated_at = now()
    from candidates
    where game.id = candidates.id
    returning game.id
  )
  select claimed.id from claimed;
$$;

revoke all on function public.claim_game_description_jobs(text[], integer) from public;
grant execute on function public.claim_game_description_jobs(text[], integer) to service_role;
