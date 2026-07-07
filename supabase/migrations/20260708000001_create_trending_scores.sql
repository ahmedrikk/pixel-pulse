-- Real-world trending signal table.
-- Populated by the compute-trending Supabase Edge Function (hourly).
create table if not exists public.trending_scores (
  game_id          text primary key references public.games(id) on delete cascade,
  name             text not null,
  news_score       float default 0,
  steam_score      float default 0,
  twitch_score     float default 0,
  esports_score    float default 0,
  community_score  float default 0,
  rawg_score       float default 0,
  release_proximity_score float default 0,
  composite_score  float default 0,
  computed_at      timestamptz default now()
);

-- Helpful indexes for the frontend lookups.
create index if not exists idx_trending_scores_composite on public.trending_scores (composite_score desc);
create index if not exists idx_trending_scores_computed_at on public.trending_scores (computed_at desc);

alter table public.trending_scores enable row level security;

do $$ begin
  create policy "trending_scores are publicly readable"
    on public.trending_scores for select using (true);
exception when duplicate_object then
  null;
end $$;

do $$ begin
  create policy "service role can write trending_scores"
    on public.trending_scores for all using (auth.role() = 'service_role');
exception when duplicate_object then
  null;
end $$;
