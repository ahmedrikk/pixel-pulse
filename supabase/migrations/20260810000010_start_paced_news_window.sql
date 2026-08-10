-- The legacy bulk run filled the old rolling window before pacing existed.
-- Start enforcement from the paced system's activation point so old articles
-- remain available for endless scroll without blocking all new publishing.
alter table public.news_ingestion_budget
  add column if not exists enforcement_started_at timestamptz;

update public.news_ingestion_budget
set enforcement_started_at = coalesce(enforcement_started_at, now()),
    updated_at = now()
where budget_key = 'rss_articles';

alter table public.news_ingestion_budget
  alter column enforcement_started_at set default now();
