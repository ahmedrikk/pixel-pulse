-- Real data for the Leaderboard page (QA F8) and Hub Hype Meter (QA F9).
--
-- Leaderboards: profiles is publicly readable, but xp_events / predictions
-- are RLS-restricted to their owners, so global rankings are exposed through
-- SECURITY DEFINER functions that only return aggregates + public profile
-- fields.
--
-- Hype meter: hype_votes stores one vote per (user, game). Rows are only
-- readable by their owner; the public list comes from the aggregate RPC.

-- ── Hype votes ──────────────────────────────────────────────────────────────
create table if not exists public.hype_votes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  game_id    text not null,
  game_name  text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create index if not exists idx_hype_votes_game on public.hype_votes(game_id);

alter table public.hype_votes enable row level security;

do $$ begin
  create policy "users read own hype votes"
    on public.hype_votes for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users insert own hype votes"
    on public.hype_votes for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users delete own hype votes"
    on public.hype_votes for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create or replace function public.get_hype_leaderboard()
returns table (game_id text, game_name text, votes bigint, recent_votes bigint)
language sql stable security definer set search_path = public as $$
  select
    hv.game_id,
    max(hv.game_name) as game_name,
    count(*)::bigint as votes,
    count(*) filter (where hv.created_at >= now() - interval '7 days')::bigint as recent_votes
  from hype_votes hv
  group by hv.game_id
  order by votes desc
  limit 50;
$$;

-- ── Leaderboards ────────────────────────────────────────────────────────────
create or replace function public.get_season_leaderboard(limit_count int default 50)
returns table (
  user_id uuid, username text, avatar_url text, avatar_initials text,
  avatar_color text, xp_season int, tier int, daily_streak int
)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.display_name, p.username, 'Player'),
         p.avatar_url, p.avatar_initials, p.avatar_color,
         coalesce(p.xp_season, 0), coalesce(p.tier, 0), coalesce(p.daily_streak, 0)
  from profiles p
  where p.onboarding_completed = true and coalesce(p.xp_season, 0) > 0
  order by p.xp_season desc, p.xp desc
  limit least(limit_count, 100);
$$;

create or replace function public.get_weekly_leaderboard(limit_count int default 50)
returns table (
  user_id uuid, username text, avatar_url text, avatar_initials text,
  avatar_color text, weekly_xp bigint, tier int, daily_streak int
)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.display_name, p.username, 'Player'),
         p.avatar_url, p.avatar_initials, p.avatar_color,
         sum(e.xp_awarded)::bigint as weekly_xp,
         coalesce(p.tier, 0), coalesce(p.daily_streak, 0)
  from profiles p
  join xp_events e on e.user_id = p.id
    and e.created_at >= now() - interval '7 days'
  where p.onboarding_completed = true
  group by p.id
  having sum(e.xp_awarded) > 0
  order by weekly_xp desc
  limit least(limit_count, 100);
$$;

create or replace function public.get_prediction_leaderboard(limit_count int default 50)
returns table (
  user_id uuid, username text, avatar_url text, avatar_initials text,
  avatar_color text, correct_predictions bigint, total_predictions bigint, tier int
)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.display_name, p.username, 'Player'),
         p.avatar_url, p.avatar_initials, p.avatar_color,
         count(*) filter (where pr.is_correct)::bigint as correct_predictions,
         count(*) filter (where pr.resolved_at is not null)::bigint as total_predictions,
         coalesce(p.tier, 0)
  from profiles p
  join predictions pr on pr.user_id = p.id
  where p.onboarding_completed = true
  group by p.id
  having count(*) filter (where pr.resolved_at is not null) > 0
  order by
    (count(*) filter (where pr.is_correct))::float
      / greatest(count(*) filter (where pr.resolved_at is not null), 1) desc,
    count(*) desc
  limit least(limit_count, 100);
$$;

grant execute on function public.get_hype_leaderboard() to anon, authenticated;
grant execute on function public.get_season_leaderboard(int) to anon, authenticated;
grant execute on function public.get_weekly_leaderboard(int) to anon, authenticated;
grant execute on function public.get_prediction_leaderboard(int) to anon, authenticated;
