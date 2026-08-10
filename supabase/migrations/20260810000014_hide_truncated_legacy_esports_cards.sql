-- A raw 300-character RSS slice can exceed 30 words while still ending in the
-- middle of a sentence or word. Hide those remaining legacy rows too.
update public.cached_articles
set duplicate_flag = true
where source in ('Esports Insider', 'Sheep Esports', 'Dot Esports', 'HLTV', 'VLR')
  and media_type = 'article'
  and right(trim(coalesce(nullif(ai_summary, ''), summary, '')), 1)
    not in ('.', '!', '?', '"', '''');
