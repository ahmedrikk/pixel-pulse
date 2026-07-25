-- Expand the low-quota YouTube ingestion pool and restrict Dexerto to Twitch.
-- fetch-news runs frequently for RSS freshness, but each YouTube source is
-- independently gated to one poll per 24 hours.

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
    'skill-up',
    'Skill Up',
    'UCZ7AeeVbyslLM_8-nVy2B8Q',
    'UUZ7AeeVbyslLM_8-nVy2B8Q',
    'https://www.youtube.com/@SkillUp/videos',
    24, 1440, 0, true
  ),
  (
    'digital-foundry',
    'Digital Foundry',
    'UC9PBzalIcEQCsiIkq36PyUA',
    'UU9PBzalIcEQCsiIkq36PyUA',
    'https://www.youtube.com/@DigitalFoundry/videos',
    24, 1440, 0, true
  ),
  (
    'levelcapgaming',
    'LevelCapGaming',
    'UClMXf2oP5UiW_V4dwHxY0Mg',
    'UUlMXf2oP5UiW_V4dwHxY0Mg',
    'https://www.youtube.com/@LevelCapGaming/videos',
    24, 1440, 0, true
  ),
  (
    'videogamedunkey',
    'videogamedunkey',
    'UCsvn_Po0SmunchJYOWpOxMg',
    'UUsvn_Po0SmunchJYOWpOxMg',
    'https://www.youtube.com/@videogamedunkey/videos',
    24, 1440, 0, true
  ),
  (
    'top5gaming',
    'Top5Gaming',
    'UCYn6CZe5UGIyPe9WJb0pTrg',
    'UUYn6CZe5UGIyPe9WJb0pTrg',
    'https://www.youtube.com/@T5G/videos',
    24, 1440, 0, true
  ),
  (
    'mortismal-gaming',
    'Mortismal Gaming',
    'UCEQ7KR9enYdQsB6kcMnw0NA',
    'UUEQ7KR9enYdQsB6kcMnw0NA',
    'https://www.youtube.com/@MortismalGaming/videos',
    24, 1440, 0, true
  ),
  (
    'legacykillahd',
    'LegacyKillaHD',
    'UCXIvhdNOzEdpdCSxTzsJm6w',
    'UUXIvhdNOzEdpdCSxTzsJm6w',
    'https://www.youtube.com/@LegacyKillaHD/videos',
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

update public.youtube_content_sources
set freshness_hours = 24,
    poll_interval_minutes = 1440,
    updated_at = now()
where id = 'gametrailers';

-- Old generic Dexerto cards came from the broad gaming feed. Keep only the
-- dedicated Twitch publisher in the Talus news pool.
delete from public.cached_articles
where source = 'Dexerto';
