-- Keep genre shelves useful before a category receives its first Talus review.
-- Reviewed games always rank first by the Bayesian Talus score; unrated games
-- use RAWG only as a temporary catalog-order fallback.

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
      coalesce(game.rawg_rating, 0) as rawg_rating,
      case
        when game.review_count > 0 then round((
          game.our_rating * (game.review_count::numeric / (game.review_count + 5))
          + 3.5 * (5::numeric / (game.review_count + 5))
        ), 3)
        else 0::numeric
      end as score
    from public.games game
    cross join lateral unnest(coalesce(game.genres, '{}'::text[])) as genre_slug
  ), ranked as (
    select scored.*, row_number() over (
      partition by scored.genre_slug
      order by
        (scored.review_count > 0) desc,
        scored.score desc,
        scored.review_count desc,
        scored.rawg_rating desc,
        scored.name
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
