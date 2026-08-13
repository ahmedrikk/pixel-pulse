-- Talus security hardening: close legacy public writes, restrict mutable
-- columns, and constrain profile image storage.

-- Defense in depth: every public table must have RLS enabled, including tables
-- added outside the migration sequence.
do $$
declare table_row record;
begin
  for table_row in
    select quote_ident(n.nspname) as schema_name, quote_ident(c.relname) as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('alter table %s.%s enable row level security', table_row.schema_name, table_row.table_name);
  end loop;
end $$;

-- News ingestion is server-only. These policies previously let anyone with the
-- public browser key create or overwrite published articles.
drop policy if exists "allow_anon_insert" on public.cached_articles;
drop policy if exists "allow_anon_update" on public.cached_articles;
drop policy if exists "Allow authenticated insert/update" on public.cached_articles;
revoke insert, update, delete on public.cached_articles from anon, authenticated;

-- Canonical game metadata is written by trusted ingestion services, never by
-- the browser. Community reviews remain user-writable under their own RLS.
drop policy if exists "authenticated can upsert games" on public.games;
drop policy if exists "authenticated can update games" on public.games;
revoke insert, update, delete on public.games from anon, authenticated;

-- Provider tokens were unused and must not live in a publicly-readable table.
update public.social_accounts set access_token = null, refresh_token = null
where access_token is not null or refresh_token is not null;
alter table public.social_accounts drop column if exists access_token;
alter table public.social_accounts drop column if exists refresh_token;
drop policy if exists "Social accounts are viewable by everyone" on public.social_accounts;
drop policy if exists "Users can manage own social accounts" on public.social_accounts;
create policy "users read own social accounts" on public.social_accounts
  for select to authenticated using (auth.uid() = user_id);
create policy "users insert own social accounts" on public.social_accounts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own social accounts" on public.social_accounts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own social accounts" on public.social_accounts
  for delete to authenticated using (auth.uid() = user_id);

-- Steam libraries are private account data.
drop policy if exists "Steam profiles are viewable by everyone" on public.steam_profiles;
drop policy if exists "Users can manage own steam profile" on public.steam_profiles;
create policy "users read own steam profile" on public.steam_profiles
  for select to authenticated using (auth.uid() = user_id);
create policy "users insert own steam profile" on public.steam_profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own steam profile" on public.steam_profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own steam profile" on public.steam_profiles
  for delete to authenticated using (auth.uid() = user_id);

-- Auth owns the canonical email. Do not duplicate it into a publicly-readable
-- profile row.
alter table public.profiles drop column if exists email;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(split_part(coalesce(new.email, new.id::text), '@', 1)),
    split_part(coalesce(new.email, 'Talus player'), '@', 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- RLS controls rows; column privileges separately prevent clients from
-- changing XP, account state, streaks, timestamps, or other system fields.
revoke insert, update on public.profiles from authenticated;
grant insert (id, username, display_name, about_me, avatar_url, banner_url,
  nameplate_url, onboarding_completed, onboarding_step,
  onboarding_completed_at, platforms, skill_level, fav_game_ids, fav_genres,
  avatar_type, avatar_initials, avatar_color, updated_at)
  on public.profiles to authenticated;
grant update (username, display_name, about_me, avatar_url, banner_url,
  nameplate_url, onboarding_completed, onboarding_step,
  onboarding_completed_at, platforms, skill_level, fav_game_ids, fav_genres,
  avatar_type, avatar_initials, avatar_color, updated_at)
  on public.profiles to authenticated;

-- Review counters and ownership are server-derived and immutable by clients.
revoke insert, update on public.user_game_reviews from authenticated;
grant insert (user_id, game_id, star_rating, review_text, tags)
  on public.user_game_reviews to authenticated;
grant update (star_rating, review_text, tags, updated_at)
  on public.user_game_reviews to authenticated;

alter table public.profiles
  add constraint profiles_username_length check (username is null or char_length(username) between 3 and 30) not valid,
  add constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 1 and 60) not valid,
  add constraint profiles_about_me_length check (about_me is null or char_length(about_me) <= 500) not valid;
alter table public.user_game_reviews
  add constraint user_game_reviews_text_length check (review_text is null or char_length(review_text) <= 5000) not valid;

-- Storage validates both the browser-supplied MIME type and ownership. The app
-- also checks file signatures before upload.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';

drop policy if exists "Users upload own avatar" on storage.objects;
drop policy if exists "users update own profile images" on storage.objects;
drop policy if exists "users delete own profile images" on storage.objects;
create policy "Users upload own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );
create policy "users update own profile images" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and owner_id = auth.uid()::text)
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );
create policy "users delete own profile images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and owner_id = auth.uid()::text);

-- These operational tables are populated only by service-role workers. Some
-- older environments do not have every table, so apply the grant hardening to
-- the relations that exist instead of making deployment depend on legacy names.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'trending_scores',
    'free_game_offers',
    'game_patch_sources',
    'game_patches',
    'news_sources',
    'news_ingestion_runs',
    'news_ingestion_items',
    'backend_api_audit_snapshots',
    'operational_controls'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke insert, update, delete on public.%I from anon, authenticated', table_name);
    end if;
  end loop;
end $$;
