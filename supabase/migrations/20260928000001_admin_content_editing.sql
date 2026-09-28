-- Secure editorial controls for published news cards and canonical game pages.
-- All writes stay behind the existing Talus administrator gate and are audited.

create or replace function public.admin_list_articles(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  search_term text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_talus_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(rows) order by rows.article_date desc), '[]'::jsonb),
    'total', (
      select count(*)
      from public.cached_articles article
      where article.media_type <> 'youtube'
        and (search_term is null or article.source ilike '%' || search_term || '%'
          or article.title ilike '%' || search_term || '%'
          or article.ai_title ilike '%' || search_term || '%')
    )
  )
  into result
  from (
    select article.id, article.source, article.source_url, article.article_date,
      article.fetched_at, article.title as source_title,
      coalesce(nullif(article.ai_title, ''), article.title) as headline,
      coalesce(nullif(article.ai_summary, ''), article.summary) as summary,
      coalesce(nullif(article.og_image_url, ''), article.image_url) as image_url,
      not article.duplicate_flag and article.report_count < 3 as visible
    from public.cached_articles article
    where article.media_type <> 'youtube'
      and (search_term is null or article.source ilike '%' || search_term || '%'
        or article.title ilike '%' || search_term || '%'
        or article.ai_title ilike '%' || search_term || '%')
    order by article.article_date desc
    limit safe_limit offset safe_offset
  ) rows;

  return result;
end;
$$;

revoke all on function public.admin_list_articles(text, integer, integer) from public, anon;
grant execute on function public.admin_list_articles(text, integer, integer) to authenticated;

create or replace function public.admin_update_article(
  p_article_id uuid,
  p_headline text,
  p_summary text,
  p_image_url text,
  p_visible boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clean_headline text := trim(coalesce(p_headline, ''));
  clean_summary text := trim(coalesce(p_summary, ''));
  clean_image text := trim(coalesce(p_image_url, ''));
begin
  if not public.is_talus_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  if char_length(clean_headline) < 8 or char_length(clean_headline) > 180 then
    raise exception 'Headline must be between 8 and 180 characters';
  end if;
  if char_length(clean_summary) < 40 or char_length(clean_summary) > 1200 then
    raise exception 'Summary must be between 40 and 1200 characters';
  end if;
  if clean_image <> '' and clean_image !~* '^https://[^[:space:]]+$' then
    raise exception 'Image must use a valid HTTPS URL';
  end if;

  update public.cached_articles
  set ai_title = clean_headline,
      ai_summary = clean_summary,
      og_image_url = nullif(clean_image, ''),
      duplicate_flag = not coalesce(p_visible, true)
  where id = p_article_id and media_type <> 'youtube';
  if not found then raise exception 'Article unavailable'; end if;

  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'update', 'news_article', p_article_id::text,
    jsonb_build_object('fields', jsonb_build_array('headline', 'summary', 'image_url', 'visible'), 'visible', p_visible));
end;
$$;

revoke all on function public.admin_update_article(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.admin_update_article(uuid, text, text, text, boolean) to authenticated;

create or replace function public.admin_list_games(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  search_term text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_talus_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(rows) order by rows.name), '[]'::jsonb),
    'total', (select count(*) from public.games game where search_term is null or game.name ilike '%' || search_term || '%')
  )
  into result
  from (
    select game.id, game.slug, game.name, game.description, game.cover_image,
      game.genres, game.platforms, game.release_date, game.developer, game.publisher,
      game.description_status, game.image_status, game.review_count, game.updated_at
    from public.games game
    where search_term is null or game.name ilike '%' || search_term || '%'
    order by game.name
    limit safe_limit offset safe_offset
  ) rows;

  return result;
end;
$$;

revoke all on function public.admin_list_games(text, integer, integer) from public, anon;
grant execute on function public.admin_list_games(text, integer, integer) to authenticated;

create or replace function public.admin_update_game(
  p_game_id text,
  p_name text,
  p_description text,
  p_cover_image text,
  p_genres text[],
  p_platforms text[],
  p_release_date date,
  p_developer text,
  p_publisher text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clean_name text := trim(coalesce(p_name, ''));
  clean_description text := trim(coalesce(p_description, ''));
  clean_cover text := trim(coalesce(p_cover_image, ''));
  clean_developer text := nullif(trim(coalesce(p_developer, '')), '');
  clean_publisher text := nullif(trim(coalesce(p_publisher, '')), '');
begin
  if not public.is_talus_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  if char_length(clean_name) < 1 or char_length(clean_name) > 140 then
    raise exception 'Game name must be between 1 and 140 characters';
  end if;
  if char_length(clean_description) < 120 or char_length(clean_description) > 12000 then
    raise exception 'Description must be between 120 and 12000 characters';
  end if;
  if clean_cover <> '' and clean_cover !~* '^(https://[^[:space:]]+|/[^[:space:]]+)$' then
    raise exception 'Cover image must use HTTPS or a site-relative path';
  end if;
  if cardinality(coalesce(p_genres, '{}'::text[])) > 20 or cardinality(coalesce(p_platforms, '{}'::text[])) > 20 then
    raise exception 'Too many genres or platforms';
  end if;
  if char_length(coalesce(clean_developer, '')) > 240 or char_length(coalesce(clean_publisher, '')) > 240 then
    raise exception 'Developer and publisher must be 240 characters or fewer';
  end if;

  update public.games
  set name = clean_name,
      description = clean_description,
      cover_image = nullif(clean_cover, ''),
      genres = coalesce(p_genres, '{}'::text[]),
      platforms = coalesce(p_platforms, '{}'::text[]),
      release_date = p_release_date,
      developer = clean_developer,
      publisher = clean_publisher,
      description_status = 'ready',
      description_generated_at = now(),
      description_style_version = 'admin-edited-v1',
      image_source = case when clean_cover = '' then 'missing' else 'admin' end,
      image_status = case when clean_cover = '' then 'missing' else 'real' end,
      image_checked_at = now(),
      expires_at = '2099-12-31 23:59:59+00'::timestamptz,
      updated_at = now()
  where id = p_game_id;
  if not found then raise exception 'Game unavailable'; end if;

  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'update', 'game', p_game_id,
    jsonb_build_object('fields', jsonb_build_array('name', 'description', 'cover_image', 'genres', 'platforms', 'release_date', 'developer', 'publisher')));
end;
$$;

revoke all on function public.admin_update_game(text, text, text, text, text[], text[], date, text, text) from public, anon;
grant execute on function public.admin_update_game(text, text, text, text, text[], text[], date, text, text) to authenticated;
