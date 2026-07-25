-- Re-run the first GameTrailers batch through the tightened trailer-only
-- quality gate and named-entity hashtag validator.
delete from public.cached_articles
where media_type = 'youtube';
