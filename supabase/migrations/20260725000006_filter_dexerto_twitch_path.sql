-- Rebuild once more after enforcing the Twitch-only URL path. This removes a
-- non-Twitch item that Dexerto included in its nominal Twitch RSS feed.
delete from public.cached_articles
where source = 'Dexerto Twitch';
