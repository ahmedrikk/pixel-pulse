-- Real news-topic trending for the homepage sidebar.
-- Topics come from the two AI-generated tags stored on each cached article.
-- Scores use the last seven days of article volume and real interactions.

-- Older rows may contain more than two tags from the previous prompt. Keep the
-- two most specific tags already selected by the model and remove generic tags.
update public.cached_articles as article
set tags = coalesce((
  select array_agg(tag order by position)
  from (
    select tag, position
    from unnest(coalesce(article.tags, '{}'::text[])) with ordinality as value(tag, position)
    where lower(regexp_replace(tag, '[^a-zA-Z0-9]', '', 'g')) not in
      ('game', 'games', 'gaming', 'gamer', 'gamers', 'news', 'gamingnews', 'videogames', 'videogame')
      and length(regexp_replace(tag, '[^a-zA-Z0-9]', '', 'g')) >= 2
    order by position
    limit 2
  ) cleaned
), '{}'::text[]);

create index if not exists idx_cached_articles_tags_gin
  on public.cached_articles using gin(tags);
create index if not exists idx_cached_articles_article_date_desc
  on public.cached_articles(article_date desc);

create table if not exists public.article_votes (
  article_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

create index if not exists idx_article_votes_article
  on public.article_votes(article_id);
create index if not exists idx_article_votes_updated
  on public.article_votes(updated_at desc);

alter table public.article_votes enable row level security;
drop policy if exists "article votes are publicly readable" on public.article_votes;
create policy "article votes are publicly readable"
  on public.article_votes for select using (true);
drop policy if exists "users create own article votes" on public.article_votes;
create policy "users create own article votes"
  on public.article_votes for insert
  with check (auth.uid() = user_id);
drop policy if exists "users update own article votes" on public.article_votes;
create policy "users update own article votes"
  on public.article_votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "users delete own article votes" on public.article_votes;
create policy "users delete own article votes"
  on public.article_votes for delete
  using (auth.uid() = user_id);

create table if not exists public.article_shares (
  id uuid primary key default gen_random_uuid(),
  article_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  session_id text not null check (char_length(session_id) between 8 and 100),
  share_type text not null check (share_type in ('copy', 'twitter', 'whatsapp')),
  share_day date not null default current_date,
  created_at timestamptz not null default now(),
  unique (article_id, session_id, share_type, share_day)
);

create index if not exists idx_article_shares_article
  on public.article_shares(article_id);
create index if not exists idx_article_shares_created
  on public.article_shares(created_at desc);

alter table public.article_shares enable row level security;
-- Raw share events stay private. Inserts go through the validated RPC below.

create or replace function public.get_article_engagement(p_article_ids text[])
returns table (
  article_id text,
  upvotes bigint,
  downvotes bigint,
  comments bigint,
  shares bigint,
  user_vote smallint
)
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select distinct unnest(coalesce(p_article_ids, '{}'::text[])) as article_id
  ),
  vote_counts as (
    select v.article_id,
      count(*) filter (where v.vote = 1) as upvotes,
      count(*) filter (where v.vote = -1) as downvotes
    from public.article_votes v
    where v.article_id = any(coalesce(p_article_ids, '{}'::text[]))
    group by v.article_id
  ),
  comment_counts as (
    select c.article_id, count(*) as comments
    from public.article_comments c
    where c.article_id = any(coalesce(p_article_ids, '{}'::text[]))
      and c.deleted_at is null
    group by c.article_id
  ),
  share_counts as (
    select s.article_id, count(*) as shares
    from public.article_shares s
    where s.article_id = any(coalesce(p_article_ids, '{}'::text[]))
    group by s.article_id
  )
  select requested.article_id,
    coalesce(vote_counts.upvotes, 0),
    coalesce(vote_counts.downvotes, 0),
    coalesce(comment_counts.comments, 0),
    coalesce(share_counts.shares, 0),
    (
      select vote
      from public.article_votes own_vote
      where own_vote.article_id = requested.article_id
        and own_vote.user_id = auth.uid()
    ) as user_vote
  from requested
  left join vote_counts using (article_id)
  left join comment_counts using (article_id)
  left join share_counts using (article_id);
$$;

create or replace function public.set_article_vote(p_article_id text, p_vote smallint)
returns table (
  article_id text,
  upvotes bigint,
  downvotes bigint,
  comments bigint,
  shares bigint,
  user_vote smallint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_article_id is null or char_length(trim(p_article_id)) < 3 then
    raise exception 'Invalid article';
  end if;
  if p_vote not in (-1, 0, 1) then
    raise exception 'Invalid vote';
  end if;

  if p_vote = 0 then
    delete from public.article_votes
    where article_votes.article_id = p_article_id
      and article_votes.user_id = auth.uid();
  else
    insert into public.article_votes(article_id, user_id, vote)
    values (p_article_id, auth.uid(), p_vote)
    on conflict (article_id, user_id) do update
      set vote = excluded.vote, updated_at = now();
  end if;

  return query
    select * from public.get_article_engagement(array[p_article_id]);
end;
$$;

create or replace function public.record_article_share(
  p_article_id text,
  p_share_type text,
  p_session_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_article_id is null or char_length(trim(p_article_id)) < 3 then
    raise exception 'Invalid article';
  end if;
  if p_share_type not in ('copy', 'twitter', 'whatsapp') then
    raise exception 'Invalid share type';
  end if;
  if p_session_id is null or char_length(p_session_id) not between 8 and 100 then
    raise exception 'Invalid session';
  end if;

  insert into public.article_shares(article_id, user_id, session_id, share_type)
  values (p_article_id, auth.uid(), p_session_id, p_share_type)
  on conflict (article_id, session_id, share_type, share_day) do nothing;
end;
$$;

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

revoke all on function public.get_article_engagement(text[]) from public;
revoke all on function public.set_article_vote(text, smallint) from public;
revoke all on function public.record_article_share(text, text, text) from public;
revoke all on function public.get_trending_topics(integer) from public;

grant execute on function public.get_article_engagement(text[]) to anon, authenticated;
grant execute on function public.set_article_vote(text, smallint) to authenticated;
grant execute on function public.record_article_share(text, text, text) to anon, authenticated;
grant execute on function public.get_trending_topics(integer) to anon, authenticated;

