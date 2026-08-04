-- Talus Document 3: private source notes, public rewritten patch pages.

alter table public.game_patches
  add column if not exists source_title text not null default '',
  add column if not exists source_content text not null default '',
  add column if not exists editorial_status text not null default 'pending'
    check (editorial_status in ('pending', 'generating', 'ready', 'failed')),
  add column if not exists editorial_content jsonb not null default '{}'::jsonb,
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists editorial_style_version text,
  add column if not exists editorial_generated_at timestamptz,
  add column if not exists editorial_error text;

alter table public.game_patches alter column title drop not null;

-- Existing values came straight from Steam. Preserve them only as private source
-- material and queue every item for its original Talus rewrite.
update public.game_patches
set
  source_title = coalesce(nullif(source_title, ''), title, ''),
  source_content = coalesce(nullif(source_content, ''), content_text, ''),
  title = null,
  summary = '',
  content_text = '',
  editorial_content = '{}'::jsonb,
  meta_title = null,
  meta_description = null,
  editorial_status = 'pending',
  editorial_style_version = null,
  editorial_generated_at = null,
  editorial_error = null,
  updated_at = now()
where editorial_status <> 'ready'
   or editorial_style_version is null;

create index if not exists game_patches_editorial_queue_idx
  on public.game_patches (editorial_status, published_at desc);

-- Source ingestion is atomic and never overwrites a completed rewrite unless
-- the developer's source text actually changes.
create or replace function public.ingest_game_patch_sources(source_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  insert into public.game_patches (
    game_id,
    source_id,
    external_id,
    source_title,
    source_content,
    source_url,
    source_name,
    patch_type,
    version_label,
    image_url,
    published_at,
    fetched_at,
    updated_at,
    title,
    summary,
    content_text,
    editorial_status
  )
  select
    item.game_id,
    item.source_id,
    item.external_id,
    item.source_title,
    item.source_content,
    item.source_url,
    coalesce(nullif(item.source_name, ''), 'Steam Community Announcements'),
    coalesce(nullif(item.patch_type, ''), 'update'),
    item.version_label,
    item.image_url,
    item.published_at,
    coalesce(item.fetched_at, now()),
    now(),
    null,
    '',
    '',
    'pending'
  from jsonb_to_recordset(coalesce(source_rows, '[]'::jsonb)) as item(
    game_id text,
    source_id text,
    external_id text,
    source_title text,
    source_content text,
    source_url text,
    source_name text,
    patch_type text,
    version_label text,
    image_url text,
    published_at timestamptz,
    fetched_at timestamptz
  )
  where item.game_id is not null
    and item.source_id is not null
    and item.external_id is not null
    and item.source_url ~ '^https://'
  on conflict (source_id, external_id) do update set
    source_title = excluded.source_title,
    source_content = excluded.source_content,
    source_url = excluded.source_url,
    source_name = excluded.source_name,
    patch_type = excluded.patch_type,
    version_label = excluded.version_label,
    image_url = excluded.image_url,
    published_at = excluded.published_at,
    fetched_at = excluded.fetched_at,
    updated_at = now(),
    title = case
      when game_patches.source_title is distinct from excluded.source_title
        or game_patches.source_content is distinct from excluded.source_content
      then null else game_patches.title end,
    summary = case
      when game_patches.source_title is distinct from excluded.source_title
        or game_patches.source_content is distinct from excluded.source_content
      then '' else game_patches.summary end,
    content_text = case
      when game_patches.source_title is distinct from excluded.source_title
        or game_patches.source_content is distinct from excluded.source_content
      then '' else game_patches.content_text end,
    editorial_content = case
      when game_patches.source_title is distinct from excluded.source_title
        or game_patches.source_content is distinct from excluded.source_content
      then '{}'::jsonb else game_patches.editorial_content end,
    editorial_status = case
      when game_patches.source_title is distinct from excluded.source_title
        or game_patches.source_content is distinct from excluded.source_content
      then 'pending' else game_patches.editorial_status end,
    meta_title = case
      when game_patches.source_title is distinct from excluded.source_title
        or game_patches.source_content is distinct from excluded.source_content
      then null else game_patches.meta_title end,
    meta_description = case
      when game_patches.source_title is distinct from excluded.source_title
        or game_patches.source_content is distinct from excluded.source_content
      then null else game_patches.meta_description end,
    editorial_style_version = case
      when game_patches.source_title is distinct from excluded.source_title
        or game_patches.source_content is distinct from excluded.source_content
      then null else game_patches.editorial_style_version end,
    editorial_generated_at = case
      when game_patches.source_title is distinct from excluded.source_title
        or game_patches.source_content is distinct from excluded.source_content
      then null else game_patches.editorial_generated_at end,
    editorial_error = case
      when game_patches.source_title is distinct from excluded.source_title
        or game_patches.source_content is distinct from excluded.source_content
      then null else game_patches.editorial_error end;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.ingest_game_patch_sources(jsonb) from public;
grant execute on function public.ingest_game_patch_sources(jsonb) to service_role;

-- Claim a small newest-first batch. SKIP LOCKED prevents overlapping cron runs
-- from spending twice on the same patch.
create or replace function public.claim_patch_editorial_jobs(limit_count integer default 3)
returns table (
  patch_id uuid,
  game_id text,
  game_name text,
  source_title text,
  source_content text,
  source_url text,
  patch_type text,
  version_label text,
  published_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select patch.id
    from public.game_patches patch
    where patch.editorial_status in ('pending', 'failed')
      and length(trim(patch.source_title)) > 0
      and length(trim(patch.source_content)) >= 80
    order by (patch.editorial_status = 'failed'), patch.published_at desc, patch.id
    limit greatest(1, least(coalesce(limit_count, 3), 5))
    for update skip locked
  ), claimed as (
    update public.game_patches patch
    set editorial_status = 'generating', editorial_error = null, updated_at = now()
    from candidates
    where patch.id = candidates.id
    returning patch.*
  )
  select
    claimed.id,
    claimed.game_id,
    game.name,
    claimed.source_title,
    claimed.source_content,
    claimed.source_url,
    claimed.patch_type,
    claimed.version_label,
    claimed.published_at
  from claimed
  join public.games game on game.id = claimed.game_id
  order by claimed.published_at desc;
$$;

revoke all on function public.claim_patch_editorial_jobs(integer) from public;
grant execute on function public.claim_patch_editorial_jobs(integer) to service_role;

-- Only finished editorial fields are readable from the public client. Steam's
-- source body remains private to the service-role writing pipeline.
drop policy if exists "game patches are publicly readable" on public.game_patches;
drop policy if exists "published game patches are publicly readable" on public.game_patches;
create policy "published game patches are publicly readable"
  on public.game_patches for select
  using (editorial_status = 'ready');

revoke select on public.game_patches from anon, authenticated;
grant select (
  id, game_id, source_id, external_id, title, summary, content_text,
  source_url, source_name, patch_type, version_label, image_url,
  published_at, fetched_at, created_at, updated_at, editorial_status,
  editorial_content, meta_title, meta_description,
  editorial_style_version, editorial_generated_at
) on public.game_patches to anon, authenticated;

create or replace function public.get_patch_game_catalog()
returns table (
  game_id text,
  name text,
  cover_image text,
  platforms text[],
  genres text[],
  steam_appid integer,
  patch_count bigint,
  latest_patch_title text,
  latest_patch_type text,
  latest_patch_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    source.game_id,
    game.name,
    game.cover_image,
    coalesce(game.platforms, '{}'::text[]),
    coalesce(game.genres, '{}'::text[]),
    source.steam_appid,
    count(patch.id) filter (where patch.editorial_status = 'ready') as patch_count,
    latest.title,
    latest.patch_type,
    latest.published_at
  from public.game_patch_sources source
  join public.games game on game.id = source.game_id
  left join public.game_patches patch on patch.source_id = source.id
  left join lateral (
    select item.title, item.patch_type, item.published_at
    from public.game_patches item
    where item.source_id = source.id
      and item.editorial_status = 'ready'
    order by item.published_at desc
    limit 1
  ) latest on true
  where source.active = true
  group by
    source.game_id, game.name, game.cover_image, game.platforms, game.genres,
    source.steam_appid, latest.title, latest.patch_type, latest.published_at
  order by latest.published_at desc nulls last, game.name;
$$;

revoke all on function public.get_patch_game_catalog() from public;
grant execute on function public.get_patch_game_catalog() to anon, authenticated;

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fetch-game-patches';

select cron.schedule(
  'fetch-game-patches',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/fetch-game-patches',
    headers := '{"Content-Type":"application/json","apikey":"<redacted-credential>","Authorization":"Bearer <redacted-credential>"}'::jsonb,
    body := '{"mode":"scheduled"}'::jsonb
  ) as request_id;
  $$
);

select cron.unschedule(jobid)
from cron.job
where jobname = 'rewrite-game-patches';

select cron.schedule(
  'rewrite-game-patches',
  '32 * * * *',
  $$
  select net.http_post(
    url := 'https://zxcqqsviwtwxukizibef.supabase.co/functions/v1/rewrite-game-patches',
    headers := '{"Content-Type":"application/json","apikey":"<redacted-credential>","Authorization":"Bearer <redacted-credential>"}'::jsonb,
    body := '{"limit":3}'::jsonb
  ) as request_id;
  $$
);
