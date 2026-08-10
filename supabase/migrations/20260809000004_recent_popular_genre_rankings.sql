-- Build every genre shelf from games that are both recent and popular.
-- Steam/player activity is the strongest live popularity signal, followed by
-- Talus review volume and RAWG's broader audience rating. Older games remain a
-- fallback so sparse genres never render an empty shelf.

drop function if exists public.get_genre_game_rankings();

create function public.get_genre_game_rankings()
returns table (
  genre text,
  game_id text,
  name text,
  cover_image text,
  platforms text[],
  release_date text,
  rawg_rating numeric,
  our_rating numeric,
  review_count integer,
  popularity_score numeric,
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
      game.release_date,
      coalesce(game.rawg_rating, 0)::numeric as rawg_rating,
      coalesce(game.our_rating, 0)::numeric as our_rating,
      coalesce(game.review_count, 0)::integer as review_count,
      case
        when game.release_date ~ '^\d{4}-\d{2}-\d{2}$' then game.release_date::date
        else null
      end as released_on,
      (
        coalesce(trend.steam_score, 0) * 0.75
        + coalesce(trend.release_proximity_score, 0) * 0.25
      )::numeric as popularity,
      (
        coalesce(trend.steam_score, 0) * 0.55
        + coalesce(trend.release_proximity_score, 0) * 0.20
        + least(coalesce(game.review_count, 0), 250) * 0.10
        + coalesce(game.rawg_rating, 0) * 5
      )::numeric as score
    from public.games game
    cross join lateral unnest(coalesce(game.genres, '{}'::text[])) as genre_slug
    left join public.trending_scores trend on trend.game_id = game.id
  ), ranked as (
    select scored.*, row_number() over (
      partition by scored.genre_slug
      order by
        -- Prefer released games from the last three years, then live popularity.
        (scored.released_on between current_date - interval '3 years' and current_date) desc,
        scored.popularity desc,
        scored.score desc,
        scored.released_on desc nulls last,
        scored.rawg_rating desc,
        scored.name
    ) as position
    from scored
    where scored.released_on is null or scored.released_on <= current_date
  )
  select
    ranked.genre_slug,
    ranked.id,
    ranked.name,
    ranked.cover_image,
    ranked.platforms,
    ranked.release_date,
    ranked.rawg_rating,
    ranked.our_rating,
    ranked.review_count,
    ranked.popularity,
    ranked.score
  from ranked
  where ranked.position <= 6
  order by ranked.genre_slug, ranked.position;
$$;

revoke all on function public.get_genre_game_rankings() from public;
grant execute on function public.get_genre_game_rankings() to anon, authenticated;
