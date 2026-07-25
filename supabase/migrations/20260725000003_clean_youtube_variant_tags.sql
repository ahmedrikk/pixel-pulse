-- Do not let a shortened spelling variant occupy the second hashtag slot.
update public.cached_articles
set tags = array[tags[1], 'GameTrailers']::text[]
where media_type = 'youtube'
  and cardinality(tags) >= 2
  and (
    lower(regexp_replace(tags[1], '[^a-zA-Z0-9]', '', 'g'))
      like '%' || lower(regexp_replace(tags[2], '[^a-zA-Z0-9]', '', 'g')) || '%'
    or lower(regexp_replace(tags[2], '[^a-zA-Z0-9]', '', 'g'))
      like '%' || lower(regexp_replace(tags[1], '[^a-zA-Z0-9]', '', 'g')) || '%'
  );
