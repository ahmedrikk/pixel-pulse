-- Talus Game record: canonical metadata shared by Reviews, Free Games, and Game Patch.

alter table public.games
  add column if not exists developer text,
  add column if not exists publisher text,
  add column if not exists external_ratings jsonb not null default '[]'::jsonb,
  add column if not exists our_rating numeric(3,2) not null default 0,
  add column if not exists review_count integer not null default 0,
  add column if not exists free_now boolean not null default false,
  add column if not exists free_offer_url text,
  add column if not exists free_offer_store text,
  add column if not exists free_offer_ends_at timestamptz,
  add column if not exists description_status text not null default 'legacy',
  add column if not exists description_generated_at timestamptz,
  add column if not exists description_style_version text;

alter table public.games
  drop constraint if exists games_description_status_check;
alter table public.games
  add constraint games_description_status_check
  check (description_status in ('missing', 'legacy', 'generating', 'ready', 'failed'));
alter table public.games alter column description_status set default 'missing';

create unique index if not exists games_slug_unique_idx on public.games (slug);
create index if not exists games_genres_gin_idx on public.games using gin (genres);
create index if not exists games_rating_rank_idx on public.games (our_rating desc, review_count desc);
create index if not exists games_free_now_idx on public.games (free_now, free_offer_ends_at)
  where free_now = true;

-- Preserve the existing source-specific score columns while also exposing a
-- single extensible ratings list to every consumer.
update public.games game
set external_ratings = (
  select coalesce(
    jsonb_agg(jsonb_build_object('source', rating.source, 'score', rating.score, 'scale', rating.scale)),
    '[]'::jsonb
  )
  from (
    values
      ('RAWG'::text, game.rawg_rating::numeric, 5::numeric),
      ('Metacritic'::text, game.metacritic_score::numeric, 100::numeric),
      ('OpenCritic'::text, game.opencritic_score::numeric, 100::numeric)
  ) as rating(source, score, scale)
  where rating.score is not null
)
where external_ratings = '[]'::jsonb;

-- Review votes are stored as one row per user/review. The review counters are
-- derived display values, never the source of truth.
alter table public.user_game_reviews
  add column if not exists downvote_votes integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

delete from public.user_game_reviews older
using public.user_game_reviews newer
where older.user_id = newer.user_id
  and older.game_id = newer.game_id
  and (coalesce(older.created_at, 'epoch'::timestamptz), older.id)
    < (coalesce(newer.created_at, 'epoch'::timestamptz), newer.id);

create unique index if not exists user_game_reviews_user_game_unique_idx
  on public.user_game_reviews (user_id, game_id);

create table if not exists public.game_review_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.user_game_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('up', 'down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create table if not exists public.game_review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.user_game_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_comment_id uuid references public.game_review_comments(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists game_review_votes_review_idx on public.game_review_votes (review_id);
create index if not exists game_review_comments_review_date_idx
  on public.game_review_comments (review_id, created_at);

alter table public.game_review_votes enable row level security;
alter table public.game_review_comments enable row level security;

drop policy if exists "users read own game review votes" on public.game_review_votes;
create policy "users read own game review votes"
  on public.game_review_votes for select using (auth.uid() = user_id);
drop policy if exists "users create own game review votes" on public.game_review_votes;
create policy "users create own game review votes"
  on public.game_review_votes for insert with check (auth.uid() = user_id);
drop policy if exists "users update own game review votes" on public.game_review_votes;
create policy "users update own game review votes"
  on public.game_review_votes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users delete own game review votes" on public.game_review_votes;
create policy "users delete own game review votes"
  on public.game_review_votes for delete using (auth.uid() = user_id);

drop policy if exists "game review comments are publicly readable" on public.game_review_comments;
create policy "game review comments are publicly readable"
  on public.game_review_comments for select using (true);
drop policy if exists "users create own game review comments" on public.game_review_comments;
create policy "users create own game review comments"
  on public.game_review_comments for insert with check (auth.uid() = user_id);
drop policy if exists "users update own game review comments" on public.game_review_comments;
create policy "users update own game review comments"
  on public.game_review_comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users delete own game review comments" on public.game_review_comments;
create policy "users delete own game review comments"
  on public.game_review_comments for delete using (auth.uid() = user_id);

create or replace function public.refresh_game_review_stats(target_game_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.games game
  set
    our_rating = coalesce(stats.average_rating, 0),
    review_count = coalesce(stats.total_reviews, 0),
    updated_at = now()
  from (
    select
      round(avg(review.star_rating)::numeric, 2) as average_rating,
      count(*)::integer as total_reviews
    from public.user_game_reviews review
    where review.game_id = target_game_id
  ) stats
  where game.id = target_game_id;
end;
$$;

create or replace function public.on_game_review_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_game_review_stats(old.game_id);
    return old;
  end if;

  perform public.refresh_game_review_stats(new.game_id);
  if tg_op = 'UPDATE' and old.game_id is distinct from new.game_id then
    perform public.refresh_game_review_stats(old.game_id);
  end if;
  return new;
end;
$$;

drop trigger if exists game_review_stats_trigger on public.user_game_reviews;
create trigger game_review_stats_trigger
after insert or update of game_id, star_rating or delete on public.user_game_reviews
for each row execute function public.on_game_review_changed();

do $$
declare game_row record;
begin
  for game_row in select id from public.games loop
    perform public.refresh_game_review_stats(game_row.id);
  end loop;
end;
$$;

create or replace function public.toggle_game_review_vote(p_review_id uuid, p_direction text)
returns table (upvote_count integer, downvote_count integer, user_vote text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_direction text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_direction not in ('up', 'down') then
    raise exception 'Vote direction must be up or down';
  end if;
  if not exists (select 1 from public.user_game_reviews where id = p_review_id) then
    raise exception 'Review not found';
  end if;

  select vote.direction into existing_direction
  from public.game_review_votes vote
  where vote.review_id = p_review_id and vote.user_id = current_user_id;

  if existing_direction = p_direction then
    delete from public.game_review_votes
    where review_id = p_review_id and user_id = current_user_id;
    existing_direction := null;
  else
    insert into public.game_review_votes (review_id, user_id, direction)
    values (p_review_id, current_user_id, p_direction)
    on conflict (review_id, user_id) do update
      set direction = excluded.direction, updated_at = now();
    existing_direction := p_direction;
  end if;

  select
    count(*) filter (where vote.direction = 'up')::integer,
    count(*) filter (where vote.direction = 'down')::integer
  into upvote_count, downvote_count
  from public.game_review_votes vote
  where vote.review_id = p_review_id;

  update public.user_game_reviews
  set helpful_votes = upvote_count, downvote_votes = downvote_count, updated_at = now()
  where id = p_review_id;

  user_vote := existing_direction;
  return next;
end;
$$;

revoke all on function public.toggle_game_review_vote(uuid, text) from public;
grant execute on function public.toggle_game_review_vote(uuid, text) to authenticated;

-- Attach every historical free offer to its canonical Game record before
-- removing the duplicated game metadata from the offer table.
alter table public.free_game_offers add column if not exists game_id text;

with normalized as (
  select distinct on (game_id)
    game_id,
    title,
    image_url,
    platforms
  from (
    select
      trim(both '-' from regexp_replace(
        lower(regexp_replace(title, '\s*\((steam|epic games|gog|itch\.io|pc|mobile)\)\s*(key)?\s*$', '', 'i')),
        '[^a-z0-9]+', '-', 'g'
      )) as game_id,
      regexp_replace(title, '\s*\((steam|epic games|gog|itch\.io|pc|mobile)\)\s*(key)?\s*$', '', 'i') as title,
      image_url,
      platforms,
      case when source_name = 'Epic Games Store' then 0 else 1 end as priority
    from public.free_game_offers
  ) offers
  where game_id <> ''
  order by game_id, priority
)
insert into public.games (
  id, slug, name, cover_image, platforms, description, description_status, expires_at, updated_at
)
select
  game_id, game_id, title, image_url, coalesce(platforms, '{}'::text[]), '', 'missing',
  now() + interval '10 years', now()
from normalized
on conflict (id) do update set
  name = case when games.name = games.id then excluded.name else games.name end,
  cover_image = case when coalesce(games.cover_image, '') = '' then excluded.cover_image else games.cover_image end,
  platforms = case when cardinality(coalesce(games.platforms, '{}'::text[])) = 0 then excluded.platforms else games.platforms end,
  updated_at = now();

update public.free_game_offers offer
set game_id = trim(both '-' from regexp_replace(
  lower(regexp_replace(offer.title, '\s*\((steam|epic games|gog|itch\.io|pc|mobile)\)\s*(key)?\s*$', '', 'i')),
  '[^a-z0-9]+', '-', 'g'
));

alter table public.free_game_offers
  alter column game_id set not null,
  add constraint free_game_offers_game_id_fkey
    foreign key (game_id) references public.games(id) on delete cascade;

create index if not exists free_game_offers_game_status_idx
  on public.free_game_offers (game_id, status, ends_at);

alter table public.free_game_offers
  drop column if exists title,
  drop column if exists description,
  drop column if exists image_url,
  drop column if exists thumbnail_url,
  drop column if exists platforms;

create or replace function public.refresh_game_free_state(target_game_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare current_offer record;
begin
  select offer.offer_url, offer.store_name, offer.ends_at
  into current_offer
  from public.free_game_offers offer
  where offer.game_id = target_game_id
    and offer.status = 'active'
    and (offer.ends_at is null or offer.ends_at > now())
  order by
    case when offer.source_name = 'Epic Games Store' then 0 else 1 end,
    offer.ends_at asc nulls last
  limit 1;

  update public.games
  set
    free_now = current_offer.offer_url is not null,
    free_offer_url = current_offer.offer_url,
    free_offer_store = current_offer.store_name,
    free_offer_ends_at = current_offer.ends_at,
    updated_at = now()
  where id = target_game_id;
end;
$$;

create or replace function public.on_free_game_offer_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_game_free_state(old.game_id);
    return old;
  end if;

  perform public.refresh_game_free_state(new.game_id);
  if tg_op = 'UPDATE' and old.game_id is distinct from new.game_id then
    perform public.refresh_game_free_state(old.game_id);
  end if;
  return new;
end;
$$;

drop trigger if exists free_game_offer_state_trigger on public.free_game_offers;
create trigger free_game_offer_state_trigger
after insert or update of game_id, status, offer_url, store_name, ends_at or delete on public.free_game_offers
for each row execute function public.on_free_game_offer_changed();

do $$
declare game_row record;
begin
  for game_row in select distinct game_id from public.free_game_offers loop
    perform public.refresh_game_free_state(game_row.game_id);
  end loop;
end;
$$;

create or replace function public.get_genre_game_rankings()
returns table (
  genre text,
  game_id text,
  name text,
  cover_image text,
  platforms text[],
  our_rating numeric,
  review_count integer,
  rank_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select
      genre_slug,
      game.id,
      game.name,
      game.cover_image,
      coalesce(game.platforms, '{}'::text[]) as platforms,
      game.our_rating,
      game.review_count,
      round((
        game.our_rating * (game.review_count::numeric / (game.review_count + 5))
        + 3.5 * (5::numeric / (game.review_count + 5))
      ), 3) as score
    from public.games game
    cross join lateral unnest(coalesce(game.genres, '{}'::text[])) as genre_slug
    where game.review_count > 0
  ), ranked as (
    select scored.*, row_number() over (
      partition by scored.genre_slug
      order by scored.score desc, scored.review_count desc, scored.our_rating desc, scored.name
    ) as position
    from scored
  )
  select
    ranked.genre_slug,
    ranked.id,
    ranked.name,
    ranked.cover_image,
    ranked.platforms,
    ranked.our_rating,
    ranked.review_count,
    ranked.score
  from ranked
  where ranked.position <= 5
  order by ranked.genre_slug, ranked.position;
$$;

revoke all on function public.get_genre_game_rankings() from public;
grant execute on function public.get_genre_game_rankings() to anon, authenticated;
