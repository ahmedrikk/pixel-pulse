-- One-time cleanup for cards written by the retired raw-RSS importer. These
-- snippets are not complete Talus summaries and should not remain visible in
-- the permanent archive. Fresh versions are published by fetch-news only after
-- passing its full summary and hashtag quality gates.
update public.cached_articles
set duplicate_flag = true
where source in ('Esports Insider', 'Sheep Esports', 'Dot Esports', 'HLTV', 'VLR')
  and media_type = 'article'
  and cardinality(
    regexp_split_to_array(trim(coalesce(nullif(ai_summary, ''), summary, '')), E'\\s+')
  ) < 30;
