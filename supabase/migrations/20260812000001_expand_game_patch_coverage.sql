-- Expand Game Patch from the original hand-curated 24 games to every
-- canonical Talus game with a valid Steam app id. The edge worker processes
-- these sources in bounded oldest-first batches, so coverage can grow without
-- making an individual cron invocation unbounded.

create index if not exists games_positive_steam_appid_idx
  on public.games (steam_appid)
  where steam_appid > 0;

with canonical_steam_games as (
  select distinct on (game.steam_appid)
    game.id as game_id,
    game.steam_appid
  from public.games game
  where game.steam_appid > 0
  order by
    game.steam_appid,
    (game.id ~ '^[0-9]+$') asc,
    length(game.id) asc,
    game.id asc
)
insert into public.game_patch_sources (
  id,
  game_id,
  steam_appid,
  source_name,
  active,
  poll_interval_minutes,
  updated_at
)
select
  'steam-' || canonical.steam_appid,
  canonical.game_id,
  canonical.steam_appid,
  'Steam Community Announcements',
  true,
  60,
  now()
from canonical_steam_games canonical
on conflict (steam_appid) do update set
  active = true,
  updated_at = now();

create or replace function public.sync_game_patch_source_from_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.steam_appid is distinct from new.steam_appid
    and coalesce(old.steam_appid, 0) > 0
  then
    update public.game_patch_sources
    set active = false, updated_at = now()
    where game_id = old.id
      and steam_appid = old.steam_appid;
  end if;

  if coalesce(new.steam_appid, 0) <= 0 then
    return new;
  end if;

  insert into public.game_patch_sources (
    id,
    game_id,
    steam_appid,
    source_name,
    active,
    poll_interval_minutes,
    updated_at
  ) values (
    'steam-' || new.steam_appid,
    new.id,
    new.steam_appid,
    'Steam Community Announcements',
    true,
    60,
    now()
  )
  on conflict (steam_appid) do update set
    active = true,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.sync_game_patch_source_from_game() from public;

drop trigger if exists sync_game_patch_source_after_game_change on public.games;
create trigger sync_game_patch_source_after_game_change
after insert or update of steam_appid on public.games
for each row
execute function public.sync_game_patch_source_from_game();

comment on function public.sync_game_patch_source_from_game() is
  'Automatically registers every canonical game with a positive Steam app id for rotating Game Patch ingestion.';
