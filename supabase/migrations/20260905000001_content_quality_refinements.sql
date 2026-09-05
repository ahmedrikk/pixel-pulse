-- Talus Content Quality Refinements v1.0

alter table public.games
  add column if not exists image_source text,
  add column if not exists image_status text not null default 'missing',
  add column if not exists image_placeholder_key text,
  add column if not exists image_checked_at timestamptz;

alter table public.games drop constraint if exists games_image_source_check;
alter table public.games add constraint games_image_source_check
  check (image_source is null or image_source in ('igdb', 'rawg', 'steam', 'placeholder', 'upload', 'manual'));
alter table public.games drop constraint if exists games_image_status_check;
alter table public.games add constraint games_image_status_check
  check (image_status in ('real', 'placeholder', 'missing'));

create or replace function public.resolve_game_placeholder_key(game_genres text[], game_platforms text[])
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  genre_text text := lower(array_to_string(coalesce(game_genres, array[]::text[]), ' '));
  platform_text text := lower(array_to_string(coalesce(game_platforms, array[]::text[]), ' '));
begin
  if genre_text ~ 'horror' then return 'genre-horror'; end if;
  if genre_text ~ 'role.playing|\brpg\b' then return 'genre-rpg'; end if;
  if genre_text ~ 'shooter|\bfps\b|adventure|action' then return 'genre-action'; end if;
  if genre_text ~ 'strategy|simulation|puzzle' then return 'genre-strategy'; end if;
  if genre_text ~ 'sport|racing' then return 'genre-sports'; end if;
  if platform_text ~ 'playstation|\bps[345]\b' then return 'platform-playstation'; end if;
  if platform_text ~ 'xbox' then return 'platform-xbox'; end if;
  if platform_text ~ 'switch|nintendo' then return 'platform-nintendo'; end if;
  if platform_text ~ '\bpc\b|windows|linux|mac' then return 'platform-pc'; end if;
  return 'generic';
end;
$$;

update public.games
set image_status = case when nullif(trim(cover_image), '') is null then 'placeholder' else 'real' end,
    image_source = case when nullif(trim(cover_image), '') is null then 'placeholder' else coalesce(image_source, 'rawg') end,
    image_placeholder_key = case
      when nullif(trim(cover_image), '') is null then public.resolve_game_placeholder_key(genres, platforms)
      else image_placeholder_key
    end
where image_checked_at is null;

create table if not exists public.game_description_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint game_description_submission_length check (
    array_length(regexp_split_to_array(trim(description), E'\\s+'), 1) between 120 and 400
  )
);

create index if not exists game_description_submissions_queue_idx
  on public.game_description_submissions(status, created_at);
create index if not exists game_description_submissions_user_idx
  on public.game_description_submissions(user_id, game_id, created_at desc);

alter table public.game_description_submissions enable row level security;
drop policy if exists "Users can read their description submissions" on public.game_description_submissions;
create policy "Users can read their description submissions"
  on public.game_description_submissions for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users can submit missing game descriptions" on public.game_description_submissions;
create policy "Users can submit missing game descriptions"
  on public.game_description_submissions for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewer_id is null
    and reviewer_notes is null
    and reviewed_at is null
    and exists (
      select 1 from public.games game
      where game.id = game_id
        and (game.description is null or trim(game.description) = '' or game.description_status <> 'ready')
    )
  );

create or replace function public.publish_approved_game_description()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.reviewed_at := coalesce(new.reviewed_at, now());
    update public.games
       set description = trim(new.description),
           description_status = 'ready',
           description_generated_at = now(),
           description_style_version = 'community-v1',
           updated_at = now()
     where id = new.game_id;
  end if;
  return new;
end;
$$;

drop trigger if exists publish_approved_game_description on public.game_description_submissions;
create trigger publish_approved_game_description
  before update on public.game_description_submissions
  for each row execute function public.publish_approved_game_description();

revoke all on public.game_description_submissions from anon;
grant select, insert on public.game_description_submissions to authenticated;
grant all on public.game_description_submissions to service_role;
revoke all on function public.publish_approved_game_description() from public, anon, authenticated;

comment on table public.game_description_submissions is
  'Community-written descriptions remain pending until manually reviewed; approval publishes the copy to the canonical Game record.';
comment on column public.games.image_placeholder_key is
  'Genre-first, then platform, then generic fallback slot while the canonical image lookup retries.';

do $$
declare existing_job record;
begin
  for existing_job in select jobid from cron.job where jobname = 'refresh-placeholder-game-images'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'refresh-placeholder-game-images',
  '20 4 */3 * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/refresh-game-images',
    headers := public.talus_edge_cron_headers(),
    body := '{"trigger":"pg_cron"}'::jsonb
  ) as request_id;
  $$
);
