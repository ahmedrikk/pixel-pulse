-- The current Sheep Esports URL returns 404 and HLTV rejects server-side RSS
-- requests with 403. Keep their registry records for future repair, but do not
-- spend a request on them every 30-minute ingestion run.
update public.news_rss_sources
set active = false,
    updated_at = now()
where id in ('sheep-esports', 'hltv');
