alter table public.game_patches
  add column if not exists seo_slug text;

update public.game_patches
set seo_slug = trim(both '-' from regexp_replace(
  regexp_replace(lower(coalesce(title, source_title, 'patch-notes')), '[^a-z0-9]+', '-', 'g'),
  '-+', '-', 'g'
))
where seo_slug is null or seo_slug = '';

update public.game_patches
set seo_slug = 'patch-' || left(id::text, 8)
where seo_slug is null or seo_slug = '';

create index if not exists game_patches_game_seo_slug_idx
  on public.game_patches (game_id, seo_slug);

grant select (
  id, game_id, source_id, external_id, title, summary, content_text,
  source_url, source_name, patch_type, version_label, image_url,
  published_at, fetched_at, created_at, updated_at, editorial_status,
  editorial_content, meta_title, meta_description, seo_slug,
  editorial_style_version, editorial_generated_at
) on public.game_patches to anon, authenticated;
