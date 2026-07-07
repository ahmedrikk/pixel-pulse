-- Add release_proximity_score to trending_scores (2026-07-07)
-- The compute-trending edge function now calculates release proximity
-- (upcoming releases like GTA VI get a boost). This column stores it.

alter table public.trending_scores
  add column if not exists release_proximity_score float default 0;
