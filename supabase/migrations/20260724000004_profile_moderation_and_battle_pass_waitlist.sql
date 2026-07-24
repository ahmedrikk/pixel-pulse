-- Profile-language safety and the Battle Pass notification waitlist.

create table if not exists public.blocked_profile_terms (
  term text primary key,
  category text not null default 'unsafe',
  match_mode text not null default 'word' check (match_mode in ('word', 'contains')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.blocked_profile_terms enable row level security;
-- No public policies: only server-side validation reads the moderation list.

insert into public.blocked_profile_terms(term, category, match_mode) values
  ('asshole', 'profanity', 'contains'),
  ('bastard', 'profanity', 'word'),
  ('bitch', 'profanity', 'contains'),
  ('bullshit', 'profanity', 'contains'),
  ('cunt', 'profanity', 'contains'),
  ('dickhead', 'profanity', 'contains'),
  ('douchebag', 'profanity', 'contains'),
  ('fuck', 'profanity', 'contains'),
  ('motherfucker', 'profanity', 'contains'),
  ('piss off', 'profanity', 'word'),
  ('shit', 'profanity', 'contains'),
  ('whore', 'profanity', 'contains'),
  ('idiot', 'harassment', 'word'),
  ('moron', 'harassment', 'word'),
  ('retard', 'harassment', 'contains'),
  ('stupid', 'harassment', 'word'),
  ('dumbass', 'harassment', 'contains'),
  ('loser', 'harassment', 'word'),
  ('kys', 'self-harm', 'word'),
  ('kill yourself', 'self-harm', 'word'),
  ('go die', 'threat', 'word'),
  ('nazi', 'extremism', 'word'),
  ('heil hitler', 'extremism', 'word'),
  ('nigger', 'slur', 'contains'),
  ('nigga', 'slur', 'contains'),
  ('faggot', 'slur', 'contains'),
  ('chink', 'slur', 'word'),
  ('spic', 'slur', 'word'),
  ('wetback', 'slur', 'contains'),
  ('tranny', 'slur', 'contains'),
  ('rape', 'sexual-violence', 'word'),
  ('rapist', 'sexual-violence', 'word')
on conflict (term) do update
set category = excluded.category,
    match_mode = excluded.match_mode,
    active = true;

create or replace function public.normalize_profile_text(value text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(
    regexp_replace(
      translate(
        replace(replace(lower(coalesce(value, '')), '@', 'a'), '$', 's'),
        '013457',
        'oleast'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.validate_profile_content(
  p_username text default null,
  p_display_name text default null,
  p_about_me text default null
)
returns table (
  is_safe boolean,
  field_name text,
  message text
)
language sql
stable
security definer
set search_path = public
as $$
  with fields(field_name, field_label, value) as (
    values
      ('username'::text, 'username'::text, p_username),
      ('display_name'::text, 'name'::text, p_display_name),
      ('about_me'::text, 'bio'::text, p_about_me)
  ),
  normalized_fields as (
    select
      field_name,
      field_label,
      public.normalize_profile_text(value) as spaced_value,
      replace(public.normalize_profile_text(value), ' ', '') as compact_value
    from fields
    where value is not null and trim(value) <> ''
  ),
  violation as (
    select normalized_fields.field_name, normalized_fields.field_label
    from normalized_fields
    join public.blocked_profile_terms blocked
      on blocked.active
      and (
        (
          blocked.match_mode = 'word'
          and (' ' || normalized_fields.spaced_value || ' ')
            like ('% ' || public.normalize_profile_text(blocked.term) || ' %')
        )
        or (
          blocked.match_mode = 'contains'
          and normalized_fields.compact_value
            like ('%' || replace(public.normalize_profile_text(blocked.term), ' ', '') || '%')
        )
      )
    order by case normalized_fields.field_name
      when 'username' then 1 when 'display_name' then 2 else 3 end
    limit 1
  )
  select
    not exists(select 1 from violation) as is_safe,
    (select violation.field_name from violation),
    (
      select 'A harmful or inappropriate word exists in your ' || violation.field_label
        || '. Please retype it to make your profile safer.'
      from violation
    ) as message;
$$;

create or replace function public.enforce_safe_profile_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  validation record;
begin
  select * into validation
  from public.validate_profile_content(new.username, new.display_name, new.about_me);

  if not validation.is_safe then
    raise exception using
      errcode = '23514',
      message = validation.message;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_safe_content on public.profiles;
create trigger profiles_safe_content
before insert or update of username, display_name, about_me
on public.profiles
for each row execute function public.enforce_safe_profile_content();

revoke all on function public.validate_profile_content(text, text, text) from public;
grant execute on function public.validate_profile_content(text, text, text) to authenticated;

create table if not exists public.battle_pass_waitlist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  display_name text,
  avatar_url text,
  banner_url text,
  joined_at timestamptz not null default now(),
  profile_updated_at timestamptz
);

alter table public.battle_pass_waitlist enable row level security;
drop policy if exists "users can view own battle pass interest" on public.battle_pass_waitlist;
create policy "users can view own battle pass interest"
  on public.battle_pass_waitlist for select
  using (auth.uid() = user_id);

create or replace function public.join_battle_pass_waitlist()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.battle_pass_waitlist(
    user_id,
    email,
    username,
    display_name,
    avatar_url,
    banner_url,
    profile_updated_at
  )
  select
    auth_user.id,
    auth_user.email,
    profile.username,
    profile.display_name,
    profile.avatar_url,
    profile.banner_url,
    profile.updated_at
  from auth.users auth_user
  left join public.profiles profile on profile.id = auth_user.id
  where auth_user.id = current_user_id
  on conflict (user_id) do update set
    email = excluded.email,
    username = excluded.username,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    banner_url = excluded.banner_url,
    profile_updated_at = excluded.profile_updated_at;

  return true;
end;
$$;

create or replace function public.is_on_battle_pass_waitlist()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.battle_pass_waitlist
      where user_id = auth.uid()
    );
$$;

revoke all on function public.join_battle_pass_waitlist() from public;
revoke all on function public.is_on_battle_pass_waitlist() from public;
grant execute on function public.join_battle_pass_waitlist() to authenticated;
grant execute on function public.is_on_battle_pass_waitlist() to authenticated;

