-- Dexerto's general feed was previously ingested by the esports worker.
-- Remove those cached rows so the dedicated Twitch-only source can rebuild
-- them as fully processed Gaming cards with summaries and hashtags.
delete from public.cached_articles
where source in ('Dexerto', 'Dexerto Twitch');
