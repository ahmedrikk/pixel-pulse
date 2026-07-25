-- Talus feed ranking v1.1 and YouTube card support.

alter table public.cached_articles
  add column if not exists media_type text not null default 'article'
    check (media_type in ('article', 'youtube')),
  add column if not exists video_id text,
  add column if not exists duplicate_flag boolean not null default false,
  add column if not exists report_count integer not null default 0
    check (report_count >= 0);

create index if not exists idx_cached_articles_feed_candidates
  on public.cached_articles(category, article_date desc)
  where duplicate_flag = false and report_count < 3;

create table if not exists public.youtube_content_sources (
  id text primary key,
  source_name text not null,
  channel_id text not null unique,
  uploads_playlist_id text not null unique,
  channel_url text not null,
  freshness_hours integer not null default 24 check (freshness_hours between 1 and 168),
  poll_interval_minutes integer not null default 120 check (poll_interval_minutes between 15 and 1440),
  minimum_daily_cards integer not null default 0 check (minimum_daily_cards >= 0),
  active boolean not null default true,
  last_polled_at timestamptz,
  quota_units_used_today integer not null default 0,
  quota_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.youtube_content_sources(
  id, source_name, channel_id, uploads_playlist_id, channel_url
) values (
  'gametrailers',
  'GameTrailers',
  'UCJx5KP-pCUmL9eZUv-mIcNw',
  'UUJx5KP-pCUmL9eZUv-mIcNw',
  'https://www.youtube.com/c/gametrailers'
)
on conflict (id) do update set
  source_name = excluded.source_name,
  channel_id = excluded.channel_id,
  uploads_playlist_id = excluded.uploads_playlist_id,
  channel_url = excluded.channel_url,
  active = true,
  updated_at = now();

alter table public.youtube_content_sources enable row level security;
-- Source configuration is private; fetch-news reads it with the service role.

create table if not exists public.feed_article_metrics (
  article_id text primary key,
  average_dwell_seconds numeric not null default 0,
  dwell_sample_count bigint not null default 0,
  read_full_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.feed_article_metrics enable row level security;

create table if not exists public.feed_impressions (
  tracking_id text not null,
  article_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  first_shown_at timestamptz not null default now(),
  last_shown_at timestamptz not null default now(),
  shown_count integer not null default 1 check (shown_count > 0),
  engaged boolean not null default false,
  primary key (tracking_id, article_id)
);

create index if not exists idx_feed_impressions_last_shown
  on public.feed_impressions(last_shown_at);
alter table public.feed_impressions enable row level security;

create table if not exists public.feed_engagement_events (
  tracking_id text not null,
  article_id text not null,
  event_type text not null check (event_type in ('read_full', 'vote', 'comment', 'share')),
  event_day date not null default current_date,
  user_id uuid references auth.users(id) on delete cascade,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  event_count integer not null default 1,
  primary key (tracking_id, article_id, event_type, event_day)
);

alter table public.feed_engagement_events enable row level security;

create table if not exists public.feed_rank_logs (
  id bigint generated always as identity primary key,
  request_bucket timestamptz not null,
  tracking_id_hash text not null,
  article_id text not null,
  position integer not null,
  final_score numeric not null,
  score_breakdown jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feed_rank_logs_created
  on public.feed_rank_logs(created_at);
alter table public.feed_rank_logs enable row level security;

create or replace function public.feed_tracking_key(p_tracking_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is not null then 'user:' || auth.uid()::text
    when p_tracking_id ~ '^[a-zA-Z0-9_-]{8,100}$' then 'guest:' || p_tracking_id
    else null
  end;
$$;

create or replace function public.get_ranked_feed(
  p_tracking_id text,
  p_offset integer default 0,
  p_limit integer default 20,
  p_category text default 'Gaming',
  p_tag text default null
)
returns table (
  id uuid,
  original_id text,
  title text,
  summary text,
  source_url text,
  image_url text,
  og_image_url text,
  category text,
  source text,
  author text,
  ai_title text,
  ai_summary text,
  tags text[],
  game_tags text[],
  likes integer,
  article_date timestamptz,
  fetched_at timestamptz,
  expires_at timestamptz,
  media_type text,
  video_id text,
  rank_score numeric,
  rank_reason text
)
language sql
volatile
security definer
set search_path = public
as $$
  with
  params as (
    select
      public.feed_tracking_key(p_tracking_id) as tracking_key,
      least(greatest(coalesce(p_limit, 20), 1), 50) as page_limit,
      greatest(coalesce(p_offset, 0), 0) as page_offset,
      date_trunc('hour', now())
        + floor(extract(minute from now()) / 15) * interval '15 minutes' as request_bucket
  ),
  followed_tags as (
    select distinct lower(regexp_replace(game_name, '[^a-zA-Z0-9]', '', 'g')) as tag
    from public.user_games
    where user_id = auth.uid() and is_favorite = true
  ),
  read_tags as (
    select distinct lower(regexp_replace(tag, '[^a-zA-Z0-9]', '', 'g')) as tag
    from public.article_reads read
    join public.cached_articles read_article
      on read.article_url in (read_article.source_url, read_article.original_id)
    cross join lateral unnest(coalesce(read_article.game_tags, '{}'::text[])) tag
    where read.user_id = auth.uid()
      and read.read_date >= now() - interval '30 days'
  ),
  vote_metrics as (
    select article_id,
      count(*) filter (where vote = 1)::numeric as upvotes,
      count(*) filter (where vote = -1)::numeric as downvotes
    from public.article_votes
    group by article_id
  ),
  comment_metrics as (
    select article_id, count(*)::numeric as comments
    from public.article_comments
    where deleted_at is null
    group by article_id
  ),
  share_metrics as (
    select article_id, count(*)::numeric as shares
    from public.article_shares
    group by article_id
  ),
  candidates as (
    select
      article.*,
      coalesce(vote.upvotes, 0) as upvotes,
      coalesce(vote.downvotes, 0) as downvotes,
      coalesce(comment.comments, 0) as comments,
      coalesce(share.shares, 0) as shares,
      coalesce(metric.average_dwell_seconds, 0) as dwell_seconds,
      coalesce(metric.read_full_count, 0) as read_full_count,
      impression.shown_count,
      impression.last_shown_at,
      coalesce(impression.engaged, false) as impression_engaged,
      exists (
        select 1
        from unnest(coalesce(article.game_tags, '{}'::text[])) game_tag
        join followed_tags follow
          on follow.tag = lower(regexp_replace(game_tag, '[^a-zA-Z0-9]', '', 'g'))
      ) as followed_match,
      exists (
        select 1
        from unnest(coalesce(article.game_tags, '{}'::text[])) game_tag
        join read_tags history
          on history.tag = lower(regexp_replace(game_tag, '[^a-zA-Z0-9]', '', 'g'))
      ) as history_match
    from public.cached_articles article
    cross join params
    left join vote_metrics vote on vote.article_id = article.original_id
    left join comment_metrics comment on comment.article_id = article.original_id
    left join share_metrics share on share.article_id = article.original_id
    left join public.feed_article_metrics metric on metric.article_id = article.original_id
    left join public.feed_impressions impression
      on impression.tracking_id = params.tracking_key
      and impression.article_id = article.original_id
    where article.article_date >= now() - interval '72 hours'
      and article.duplicate_flag = false
      and article.report_count < 3
      and (p_category is null or article.category = p_category)
      and (
        p_tag is null
        or exists (
          select 1
          from unnest(coalesce(article.tags, '{}'::text[]) || coalesce(article.game_tags, '{}'::text[])) candidate_tag
          where lower(regexp_replace(candidate_tag, '[^a-zA-Z0-9]', '', 'g'))
            = lower(regexp_replace(p_tag, '[^a-zA-Z0-9]', '', 'g'))
        )
      )
  ),
  base_scored as (
    select candidates.*,
      (
        10
        + comments * 8
        + upvotes
        - downvotes * 1.5
        + shares * 4
        + least(dwell_seconds, 60) * 0.15
        + read_full_count * 3
      )::numeric as base_score,
      power(0.5, greatest(extract(epoch from (now() - article_date)) / 3600, 0) / 18)::numeric
        as recency_multiplier
    from candidates
  ),
  personalized as (
    select base_scored.*,
      case
        when followed_match then 1.4
        when history_match then 1.15
        else 1
      end::numeric as personalization_multiplier,
      case
        when shown_count is null then 1
        when impression_engaged then 0.3
        else power(
          0.4,
          shown_count * power(
            0.5,
            greatest(extract(epoch from (now() - last_shown_at)) / 3600, 0) / 17
          )
        )
      end::numeric as impression_multiplier
    from base_scored
  ),
  initially_scored as (
    select personalized.*,
      (base_score * recency_multiplier * personalization_multiplier * impression_multiplier)::numeric
        as initial_score,
      coalesce(game_tags[1], tags[1], '') as primary_tag
    from personalized
  ),
  initial_order as (
    select initially_scored.*,
      row_number() over (order by initial_score desc, article_date desc, id) as initial_position
    from initially_scored
  ),
  diversity_context as (
    select initial_order.*,
      lag(source, 1) over (order by initial_position) as source_1,
      lag(source, 2) over (order by initial_position) as source_2,
      lag(source, 3) over (order by initial_position) as source_3,
      lag(primary_tag, 1) over (order by initial_position) as tag_1,
      lag(primary_tag, 2) over (order by initial_position) as tag_2
    from initial_order
  ),
  diversified as (
    select diversity_context.*,
      case
        when source in (source_1, source_2, source_3)
          or (primary_tag <> '' and primary_tag in (tag_1, tag_2))
        then 0.5 else 1
      end::numeric as diversity_multiplier
    from diversity_context
  ),
  final_scored as (
    select diversified.*,
      (
        initial_score
        * diversity_multiplier
        * (
          0.92
          + (
            (('x' || substr(md5(
              (select request_bucket::text from params) || ':' || original_id
            ), 1, 8))::bit(32)::bigint)::numeric / 4294967295
          ) * 0.16
        )
      )::numeric as final_score
    from diversified
  ),
  ordered as (
    select final_scored.*,
      row_number() over (order by final_score desc, article_date desc, id) as final_position
    from final_scored
  ),
  selected as materialized (
    select ordered.*
    from ordered, params
    order by final_position
    offset (select page_offset from params)
    limit (select page_limit from params)
  ),
  impression_write as (
    insert into public.feed_impressions(
      tracking_id, article_id, user_id, first_shown_at, last_shown_at, shown_count
    )
    select params.tracking_key, selected.original_id, auth.uid(), now(), now(), 1
    from selected cross join params
    where params.tracking_key is not null
    on conflict (tracking_id, article_id) do update set
      last_shown_at = excluded.last_shown_at,
      shown_count = public.feed_impressions.shown_count + 1,
      user_id = coalesce(excluded.user_id, public.feed_impressions.user_id)
    returning article_id
  ),
  log_write as (
    insert into public.feed_rank_logs(
      request_bucket, tracking_id_hash, article_id, position, final_score, score_breakdown
    )
    select
      params.request_bucket,
      md5(coalesce(params.tracking_key, 'anonymous')),
      selected.original_id,
      selected.final_position::integer,
      selected.final_score,
      jsonb_build_object(
        'base', selected.base_score,
        'recency', selected.recency_multiplier,
        'personalization', selected.personalization_multiplier,
        'impression', selected.impression_multiplier,
        'diversity', selected.diversity_multiplier
      )
    from selected cross join params
    returning article_id
  )
  select
    selected.id,
    selected.original_id,
    selected.title,
    selected.summary,
    selected.source_url,
    selected.image_url,
    selected.og_image_url,
    selected.category,
    selected.source,
    selected.author,
    selected.ai_title,
    selected.ai_summary,
    selected.tags,
    selected.game_tags,
    selected.likes,
    selected.article_date,
    selected.fetched_at,
    selected.expires_at,
    selected.media_type,
    selected.video_id,
    selected.final_score,
    case
      when selected.followed_match or selected.history_match then 'personalized'
      when selected.article_date >= now() - interval '2 hours' then 'fresh'
      when selected.comments + selected.shares + selected.upvotes >= 5 then 'trending'
      when selected.shown_count is null then 'unseen'
      else 'fallback'
    end
  from selected
  cross join (select count(*) from impression_write) impression_barrier
  cross join (select count(*) from log_write) log_barrier
  order by selected.final_position;
$$;

create or replace function public.record_article_dwell(
  p_tracking_id text,
  p_article_id text,
  p_seconds numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tracking_key text := public.feed_tracking_key(p_tracking_id);
  bounded_seconds numeric := least(greatest(coalesce(p_seconds, 0), 0), 300);
begin
  if tracking_key is null or char_length(trim(coalesce(p_article_id, ''))) < 3
    or bounded_seconds < 1 then
    return;
  end if;

  insert into public.feed_article_metrics(
    article_id, average_dwell_seconds, dwell_sample_count, updated_at
  ) values (p_article_id, bounded_seconds, 1, now())
  on conflict (article_id) do update set
    average_dwell_seconds = (
      public.feed_article_metrics.average_dwell_seconds
        * public.feed_article_metrics.dwell_sample_count
      + excluded.average_dwell_seconds
    ) / (public.feed_article_metrics.dwell_sample_count + 1),
    dwell_sample_count = public.feed_article_metrics.dwell_sample_count + 1,
    updated_at = now();
end;
$$;

create or replace function public.record_feed_engagement(
  p_tracking_id text,
  p_article_id text,
  p_event_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tracking_key text := public.feed_tracking_key(p_tracking_id);
  inserted_rows integer := 0;
begin
  if tracking_key is null or char_length(trim(coalesce(p_article_id, ''))) < 3
    or p_event_type not in ('read_full', 'vote', 'comment', 'share') then
    return;
  end if;

  insert into public.feed_engagement_events(
    tracking_id, article_id, event_type, event_day, user_id
  ) values (
    tracking_key, p_article_id, p_event_type, current_date, auth.uid()
  )
  on conflict (tracking_id, article_id, event_type, event_day) do nothing;
  get diagnostics inserted_rows = row_count;

  if inserted_rows = 0 then
    update public.feed_engagement_events
    set last_at = now(), event_count = event_count + 1
    where feed_engagement_events.tracking_id = tracking_key
      and feed_engagement_events.article_id = p_article_id
      and feed_engagement_events.event_type = p_event_type
      and feed_engagement_events.event_day = current_date;
  end if;

  update public.feed_impressions
  set engaged = true
  where tracking_id = tracking_key and article_id = p_article_id;

  if p_event_type = 'read_full' and inserted_rows > 0 then
    insert into public.feed_article_metrics(article_id, read_full_count, updated_at)
    values (p_article_id, 1, now())
    on conflict (article_id) do update set
      read_full_count = public.feed_article_metrics.read_full_count + 1,
      updated_at = now();
  end if;
end;
$$;

revoke all on function public.feed_tracking_key(text) from public;
revoke all on function public.get_ranked_feed(text, integer, integer, text, text) from public;
revoke all on function public.record_article_dwell(text, text, numeric) from public;
revoke all on function public.record_feed_engagement(text, text, text) from public;

grant execute on function public.get_ranked_feed(text, integer, integer, text, text)
  to anon, authenticated;
grant execute on function public.record_article_dwell(text, text, numeric)
  to anon, authenticated;
grant execute on function public.record_feed_engagement(text, text, text)
  to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'cleanup-feed-ranking-history';

    perform cron.schedule(
      'cleanup-feed-ranking-history',
      '25 4 * * *',
      $job$
        delete from public.feed_impressions
        where last_shown_at < now() - interval '7 days';
        delete from public.feed_engagement_events
        where last_at < now() - interval '7 days';
        delete from public.feed_rank_logs
        where created_at < now() - interval '7 days';
      $job$
    );
  end if;
end
$$;
