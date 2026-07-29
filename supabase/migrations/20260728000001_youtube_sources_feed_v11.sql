-- Talus YouTube Sources & Feed Visibility Update v1.1
-- Permanent channel IDs were resolved once from each handle's canonical URL.
-- Sources are re-polled by the existing 30-minute worker until every fresh
-- candidate is processed; last_polled_at is advanced only after the queue drains.

insert into public.youtube_content_sources (
  id,
  source_name,
  channel_id,
  uploads_playlist_id,
  channel_url,
  freshness_hours,
  poll_interval_minutes,
  minimum_daily_cards,
  active
) values
  (
    'inside-gaming',
    'Inside Gaming',
    'UCFHQlasvjQ0JMOHoKOz4c0g',
    'UUFHQlasvjQ0JMOHoKOz4c0g',
    'https://www.youtube.com/@insidegames/videos',
    24, 1440, 0, true
  ),
  (
    'clemmygames',
    'ClemmyGames',
    'UCCd3jyJmOFzkJEMj5Bp89rw',
    'UUCd3jyJmOFzkJEMj5Bp89rw',
    'https://www.youtube.com/@ClemmyGames/videos',
    24, 1440, 0, true
  ),
  (
    'indiehub01',
    'IndieHub01',
    'UCt8CJiye87FMbEwt0npPMuQ',
    'UUt8CJiye87FMbEwt0npPMuQ',
    'https://www.youtube.com/@IndieHub01/videos',
    24, 1440, 0, true
  ),
  (
    'best-indie-game-trailers',
    'Best Indie Game Trailers',
    'UCZsUA11ONDOn_XXnbEDqa5Q',
    'UUZsUA11ONDOn_XXnbEDqa5Q',
    'https://www.youtube.com/@bestindiegamestrailers/videos',
    24, 1440, 0, true
  ),
  (
    'gamingbolt',
    'GamingBolt',
    'UCXa_bzvv7Oo1glaW9FldDhQ',
    'UUXa_bzvv7Oo1glaW9FldDhQ',
    'https://www.youtube.com/@GamingBolt/videos',
    24, 1440, 0, true
  ),
  (
    'switchup',
    'SwitchUp',
    'UCILwgMbCebOqPR_6H_1m8vA',
    'UUILwgMbCebOqPR_6H_1m8vA',
    'https://www.youtube.com/@SwitchUpYt/videos',
    24, 1440, 0, true
  ),
  (
    'bellular-news',
    'Bellular News',
    'UC3nPaf5MeeDTHA2JN7clidg',
    'UU3nPaf5MeeDTHA2JN7clidg',
    'https://www.youtube.com/@BellularNews/videos',
    24, 1440, 0, true
  )
on conflict (id) do update set
  source_name = excluded.source_name,
  channel_id = excluded.channel_id,
  uploads_playlist_id = excluded.uploads_playlist_id,
  channel_url = excluded.channel_url,
  freshness_hours = 24,
  poll_interval_minutes = 1440,
  minimum_daily_cards = 0,
  active = true,
  updated_at = now();

