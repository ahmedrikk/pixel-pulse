-- Trending topics refresh in fixed 12-hour windows. The current window carries
-- four times the article weight of the previous window, so an older seven-day
-- volume leader cannot keep the widget stuck indefinitely.
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
  with params as (
    select
      date_trunc('day', now())
        + floor(extract(hour from now()) / 12) * interval '12 hours'
        as window_start
  ),
  recent_articles as (
    select
      article.original_id as article_id,
      article.article_date,
      case
        when article.article_date >= params.window_start then 8
        else 2
      end::numeric as momentum_weight,
      article.tags[1:2] as tags
    from public.cached_articles article
    cross join params
    where article.article_date >= params.window_start - interval '12 hours'
      and lower(article.category) = 'gaming'
      and article.duplicate_flag = false
      and article.report_count < 3
      and cardinality(coalesce(article.tags, '{}'::text[])) > 0
  ),
  article_topics as (
    select distinct
      recent.article_id,
      recent.article_date,
      recent.momentum_weight,
      regexp_replace(topic, '^#', '') as display_tag,
      lower(regexp_replace(topic, '[^a-zA-Z0-9]', '', 'g')) as topic_key
    from recent_articles recent
    cross join lateral unnest(recent.tags) topic
    where length(regexp_replace(topic, '[^a-zA-Z0-9]', '', 'g')) >= 2
      and lower(regexp_replace(topic, '[^a-zA-Z0-9]', '', 'g')) not in (
        'game', 'games', 'gaming', 'gamer', 'gamers', 'news',
        'gamingnews', 'videogames', 'videogame', 'entertainment'
      )
  ),
  vote_metrics as (
    select
      vote.article_id,
      count(*) filter (where vote.vote = 1) as upvotes,
      count(*) filter (where vote.vote = -1) as downvotes
    from public.article_votes vote
    cross join params
    where vote.updated_at >= params.window_start - interval '12 hours'
    group by vote.article_id
  ),
  comment_metrics as (
    select comment.article_id, count(*) as comments
    from public.article_comments comment
    cross join params
    where comment.created_at >= params.window_start - interval '12 hours'
      and comment.deleted_at is null
    group by comment.article_id
  ),
  share_metrics as (
    select share.article_id, count(*) as shares
    from public.article_shares share
    cross join params
    where share.created_at >= params.window_start - interval '12 hours'
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
      (
        sum(topic.momentum_weight * 2)
        + coalesce(sum(vote.upvotes), 0) * 3
        + coalesce(sum(vote.downvotes), 0) * 2
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
