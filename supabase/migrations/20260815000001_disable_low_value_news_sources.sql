-- Remove low-value or stale publishers from the active Talus news pool.
-- Keep their registry rows and archived articles intact for reporting and
-- historical feeds; inactive sources are ignored by future ingestion runs.

update public.news_rss_sources
set active = false,
    updated_at = now()
where id in (
  'wccftech',
  'siliconera',
  'destructoid',
  'vlr',
  'vg247'
);
