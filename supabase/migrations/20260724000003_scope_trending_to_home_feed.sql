-- The homepage trending widget must rank the same article pool that its topic
-- filter opens. Esports has a separate feed and navigation surface.
create or replace function public.get_trending_topics(p_limit integer default 5)
returns table (
  tag text,
  article_count bigint,
  upvotes bigint,
  downvotes bigint,
  comments bigint,
  shares bigint,
  trend_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with recent_articles as (
    select
      article.original_id as article_id,
      article.article_date,
      greatest(
        1,
        8 - ceil(extract(epoch from (now() - article.article_date)) / 86400)
      )::numeric as recency_weight,
      article.tags[1:2] as tags
    from public.cached_articles article
    where article.article_date >= now() - interval '7 days'
      and lower(article.category) = 'gaming'
      and cardinality(coalesce(article.tags, '{}'::text[])) > 0
  ),
  article_topics as (
    select distinct
      recent.article_id,
      recent.article_date,
      recent.recency_weight,
      regexp_replace(topic, '^#', '') as display_tag,
      lower(regexp_replace(topic, '[^a-zA-Z0-9]', '', 'g')) as topic_key
    from recent_articles recent
    cross join lateral unnest(recent.tags) topic
    where length(regexp_replace(topic, '[^a-zA-Z0-9]', '', 'g')) >= 2
      and lower(regexp_replace(topic, '[^a-zA-Z0-9]', '', 'g')) not in
        ('game', 'games', 'gaming', 'gamer', 'gamers', 'news', 'gamingnews', 'videogames', 'videogame')
  ),
  vote_metrics as (
    select
      vote.article_id,
      count(*) filter (where vote.vote = 1) as upvotes,
      count(*) filter (where vote.vote = -1) as downvotes
    from public.article_votes vote
    where vote.updated_at >= now() - interval '7 days'
    group by vote.article_id
  ),
  comment_metrics as (
    select comment.article_id, count(*) as comments
    from public.article_comments comment
    where comment.created_at >= now() - interval '7 days'
      and comment.deleted_at is null
    group by comment.article_id
  ),
  share_metrics as (
    select share.article_id, count(*) as shares
    from public.article_shares share
    where share.created_at >= now() - interval '7 days'
    group by share.article_id
  ),
  scored as (
    select
      topic.topic_key,
      max(topic.display_tag) as display_tag,
      count(distinct topic.article_id) as article_count,
      coalesce(sum(vote.upvotes), 0)::bigint as upvotes,
      coalesce(sum(vote.downvotes), 0)::bigint as downvotes,
      coalesce(sum(comment.comments), 0)::bigint as comments,
      coalesce(sum(share.shares), 0)::bigint as shares,
      greatest(0,
        sum(topic.recency_weight * 2)
        + coalesce(sum(vote.upvotes), 0) * 3
        - coalesce(sum(vote.downvotes), 0) * 2
        + coalesce(sum(comment.comments), 0) * 4
        + coalesce(sum(share.shares), 0) * 5
      )::numeric as trend_score
    from article_topics topic
    left join vote_metrics vote using (article_id)
    left join comment_metrics comment using (article_id)
    left join share_metrics share using (article_id)
    group by topic.topic_key
  )
  select
    scored.display_tag as tag,
    scored.article_count,
    scored.upvotes,
    scored.downvotes,
    scored.comments,
    scored.shares,
    scored.trend_score
  from scored
  order by scored.trend_score desc, scored.article_count desc, scored.display_tag
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke all on function public.get_trending_topics(integer) from public;
grant execute on function public.get_trending_topics(integer) to anon, authenticated;

