insert into public.games (
  id,
  slug,
  name,
  genres,
  platforms,
  release_date,
  developer,
  publisher,
  description_status,
  expires_at,
  updated_at
) values (
  'fortnite',
  'fortnite',
  'Fortnite',
  array['action', 'shooter']::text[],
  array['PC', 'PS5', 'PS4', 'Xbox', 'Switch', 'Android', 'iOS']::text[],
  '2017-07-21',
  'Epic Games',
  'Epic Games',
  'missing',
  now(),
  now()
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  genres = excluded.genres,
  platforms = excluded.platforms,
  release_date = excluded.release_date,
  developer = excluded.developer,
  publisher = excluded.publisher,
  updated_at = now();
