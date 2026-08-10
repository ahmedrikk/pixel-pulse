-- Retire the legacy esports importer, which published raw RSS teaser text,
-- and route every publisher through the same scrape, Gemini/Groq, quality,
-- deduplication, and permanent-archive pipeline used by the main feed.

insert into public.news_rss_sources
  (id, source_name, rss_url, daily_quota, min_quota, max_quota, active, display_order)
values
  ('esports-insider', 'Esports Insider', 'https://esportsinsider.com/feed', 4, 1, 7, true, 220),
  ('sheep-esports', 'Sheep Esports', 'https://www.sheepesports.com/feed', 4, 1, 7, true, 230),
  ('hltv', 'HLTV', 'https://www.hltv.org/rss/news', 4, 1, 7, true, 240),
  ('vlr', 'VLR', 'https://www.vlr.gg/rss', 4, 1, 7, true, 250)
on conflict (id) do update set
  source_name = excluded.source_name,
  rss_url = excluded.rss_url,
  daily_quota = excluded.daily_quota,
  min_quota = excluded.min_quota,
  max_quota = excluded.max_quota,
  active = excluded.active,
  display_order = excluded.display_order,
  updated_at = now();

do $$
declare
  target_job record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for target_job in
      select jobid from cron.job where jobname = 'fetch-esports-news'
    loop
      perform cron.unschedule(target_job.jobid);
    end loop;
  end if;
end
$$;

delete from public.paused_cron_jobs
where job_name = 'fetch-esports-news';
