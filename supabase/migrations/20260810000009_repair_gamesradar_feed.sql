update public.news_rss_sources
set rss_url = 'https://www.gamesradar.com/rss/',
    updated_at = now()
where id = 'gamesradar' or source_name = 'GamesRadar';
