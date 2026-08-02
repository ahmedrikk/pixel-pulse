-- Extend Free Games for first-party storefront collectors and upcoming offers.

alter table public.free_game_offers
  add column if not exists starts_at timestamptz;

alter table public.free_game_offers
  drop constraint if exists free_game_offers_status_check;

alter table public.free_game_offers
  add constraint free_game_offers_status_check
  check (status in ('active', 'upcoming', 'expired'));

create index if not exists free_game_offers_source_status_idx
  on public.free_game_offers (source_name, status);

create index if not exists free_game_offers_upcoming_idx
  on public.free_game_offers (status, starts_at)
  where status = 'upcoming';
