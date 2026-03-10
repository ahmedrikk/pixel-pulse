-- Games cache (from RAWG, 24h TTL)
create table if not exists public.games (
  id              text primary key,        -- RAWG slug
  name            text not null,
  slug            text not null,
  cover_image     text,
  genres          text[] default '{}',
  platforms       text[] default '{}',
  release_date    text,
  rawg_rating     float,
  metacritic_score int,
  steam_appid     int,
  opencritic_id   int,
  opencritic_score float,
  description     text,
  trending        boolean default false,
  expires_at      timestamptz not null
);

alter table public.games enable row level security;

create policy "games are publicly readable"
  on public.games for select using (true);

create policy "service role can write games"
  on public.games for all using (auth.role() = 'service_role');

-- Also allow anon/authenticated to upsert games (client-side cache writes)
create policy "authenticated can upsert games"
  on public.games for insert with check (true);

create policy "authenticated can update games"
  on public.games for update using (true);

-- User-submitted game reviews
create table if not exists public.user_game_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  game_id       text references public.games(id) not null,
  star_rating   int check (star_rating between 1 and 5) not null,
  review_text   text,
  tags          text[] default '{}',
  helpful_votes int default 0,
  created_at    timestamptz default now()
);

alter table public.user_game_reviews enable row level security;

create policy "reviews are publicly readable"
  on public.user_game_reviews for select using (true);

create policy "users can insert own reviews"
  on public.user_game_reviews for insert
  with check (auth.uid() = user_id);

create policy "users can update own reviews"
  on public.user_game_reviews for update
  using (auth.uid() = user_id);
