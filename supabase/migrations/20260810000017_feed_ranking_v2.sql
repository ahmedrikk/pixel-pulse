-- Talus feed display and ranking v2.0.
-- Already-fetched articles and videos are ranked independently, then woven
-- into a three-article / one-video rhythm. Fetching is intentionally untouched.

create table if not exists public.feed_ranking_settings (
  singleton boolean primary key default true check (singleton),
  video_interval integer not null default 4 check (video_interval between 2 and 10),
  comment_weight numeric not null default 8 check (comment_weight >= 0),
  share_weight numeric not null default 4 check (share_weight >= 0),
  upvote_weight numeric not null default 1 check (upvote_weight >= 0),
  downvote_weight numeric not null default 1.5 check (downvote_weight >= 0),
  dwell_weight numeric not null default 0.15 check (dwell_weight >= 0),
  dwell_cap_seconds numeric not null default 60 check (dwell_cap_seconds > 0),
  click_through_weight numeric not null default 3 check (click_through_weight >= 0),
  freshness_half_life_hours numeric not null default 18 check (freshness_half_life_hours > 0),
  first_seen_multiplier numeric not null default 0.4
    check (first_seen_multiplier > 0 and first_seen_multiplier <= 1),
  engaged_multiplier numeric not null default 0.3
    check (engaged_multiplier > 0 and engaged_multiplier <= 1),
  seen_decay_half_life_hours numeric not null default 17
    check (seen_decay_half_life_hours > 0),
  followed_tag_multiplier numeric not null default 1.4 check (followed_tag_multiplier >= 1),
  history_tag_multiplier numeric not null default 1.15 check (history_tag_multiplier >= 1),
  jitter_magnitude numeric not null default 0.08
    check (jitter_magnitude >= 0 and jitter_magnitude <= 0.25),
  jitter_window_minutes integer not null default 15
    check (jitter_window_minutes between 5 and 120),
  updated_at timestamptz not null default now()
);

insert into public.feed_ranking_settings (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.feed_ranking_settings enable row level security;
revoke all on public.feed_ranking_settings from anon, authenticated;

alter table public.feed_impressions
  add column if not exists previous_shown_count integer not null default 0,
  add column if not exists previous_last_shown_at timestamptz,
  add column if not exists current_feed_session_id text,
  add column if not exists current_session_shown_count integer not null default 0;

create index if not exists idx_feed_impressions_session
  on public.feed_impressions(tracking_id, current_feed_session_id);

create or replace function public.get_ranked_feed_v2(
  p_tracking_id text,
  p_feed_session_id text,
  p_offset integer default 0,
  p_limit integer default 20,
  p_category text default null,
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
  settings as (
    select * from public.feed_ranking_settings where singleton = true
  ),
  params as (
    select
      public.feed_tracking_key(p_tracking_id) as tracking_key,
      case
        when p_feed_session_id ~ '^[a-zA-Z0-9_-]{8,100}$' then p_feed_session_id
        else md5(coalesce(public.feed_tracking_key(p_tracking_id), 'anonymous') || ':' || now()::text)
      end as feed_session_id,
      least(greatest(coalesce(p_limit, 20), 1), 50) as page_limit,
      greatest(coalesce(p_offset, 0), 0) as page_offset,
      date_trunc('hour', now())
        + floor(extract(minute from now()) / settings.jitter_window_minutes)
          * settings.jitter_window_minutes * interval '1 minute' as request_bucket
    from settings
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
  global_impression_metrics as (
    select article_id, sum(shown_count)::numeric as impressions
    from public.feed_impressions
    group by article_id
  ),
  candidates as (
    select
      article.*,
      case when article.media_type = 'youtube' then 'video' else 'article' end as track,
      coalesce(vote.upvotes, 0) as upvotes,
      coalesce(vote.downvotes, 0) as downvotes,
      coalesce(comment.comments, 0) as comments,
      coalesce(share.shares, 0) as shares,
      coalesce(metric.average_dwell_seconds, 0) as dwell_seconds,
      coalesce(metric.read_full_count, 0) as read_full_count,
      coalesce(global_impression.impressions, 0) as global_impressions,
      case
        when impression.current_feed_session_id = params.feed_session_id
          then impression.previous_shown_count
        else impression.shown_count
      end as effective_shown_count,
      case
        when impression.current_feed_session_id = params.feed_session_id
          then impression.previous_last_shown_at
        else impression.last_shown_at
      end as effective_last_shown_at,
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
    left join global_impression_metrics global_impression on global_impression.article_id = article.original_id
    left join public.feed_impressions impression
      on impression.tracking_id = params.tracking_key
      and impression.article_id = article.original_id
    where article.duplicate_flag = false
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
  scored_layers as (
    select candidates.*,
      greatest(
        0.1,
        10
          + comments * settings.comment_weight
          + shares * settings.share_weight
          + upvotes * settings.upvote_weight
          - downvotes * settings.downvote_weight
          + least(dwell_seconds, settings.dwell_cap_seconds) * settings.dwell_weight
          + least(read_full_count / greatest(global_impressions, 1), 1)
            * settings.click_through_weight
      )::numeric as base_score,
      power(
        0.5,
        greatest(extract(epoch from (now() - article_date)) / 3600, 0)
          / settings.freshness_half_life_hours
      )::numeric as freshness_multiplier,
      case
        when followed_match then settings.followed_tag_multiplier
        when history_match then settings.history_tag_multiplier
        else 1
      end::numeric as personalization_multiplier,
      case
        when effective_shown_count is null or effective_shown_count = 0 then 1
        else
          1 - (
            1 - power(
              case when impression_engaged
                then settings.engaged_multiplier
                else settings.first_seen_multiplier
              end,
              effective_shown_count
            )
          ) * power(
            0.5,
            greatest(extract(epoch from (now() - effective_last_shown_at)) / 3600, 0)
              / settings.seen_decay_half_life_hours
          )
      end::numeric as seen_multiplier
    from candidates
    cross join settings
  ),
  final_scored as (
    select scored_layers.*,
      (
        base_score
        * freshness_multiplier
        * personalization_multiplier
        * seen_multiplier
        * (
          1 - settings.jitter_magnitude
          + (
            (('x' || substr(md5(
              params.request_bucket::text || ':' || track || ':' || original_id
            ), 1, 8))::bit(32)::bigint)::numeric / 4294967295
          ) * settings.jitter_magnitude * 2
        )
      )::numeric as final_score
    from scored_layers
    cross join settings
    cross join params
  ),
  track_ranked as (
    select final_scored.*,
      row_number() over (
        partition by track
        order by final_score desc, article_date desc, id
      ) as track_position
    from final_scored
  ),
  track_counts as (
    select
      count(*) filter (where track = 'article')::integer as article_count,
      count(*) filter (where track = 'video')::integer as video_count
    from track_ranked
  ),
  assembly_limits as (
    select
      track_counts.*,
      least(
        video_count,
        floor(article_count::numeric / greatest(settings.video_interval - 1, 1))::integer
      ) as usable_video_count,
      settings.video_interval
    from track_counts
    cross join settings
  ),
  feed_positions as (
    select position
    from assembly_limits,
      lateral generate_series(1, article_count + usable_video_count) position
  ),
  assembly_map as (
    select
      position as feed_position,
      case
        when mod(position, assembly_limits.video_interval) = 0
          and position / assembly_limits.video_interval <= assembly_limits.usable_video_count
        then 'video'
        else 'article'
      end as selected_track,
      case
        when mod(position, assembly_limits.video_interval) = 0
          and position / assembly_limits.video_interval <= assembly_limits.usable_video_count
        then position / assembly_limits.video_interval
        else position - least(
          floor((position - 1)::numeric / assembly_limits.video_interval)::integer,
          assembly_limits.usable_video_count
        )
      end as selected_track_position
    from feed_positions
    cross join assembly_limits
  ),
  assembled as (
    select track_ranked.*, assembly_map.feed_position
    from assembly_map
    join track_ranked
      on track_ranked.track = assembly_map.selected_track
      and track_ranked.track_position = assembly_map.selected_track_position
  ),
  selected as materialized (
    select assembled.*
    from assembled, params
    order by feed_position
    offset (select page_offset from params)
    limit (select page_limit from params)
  ),
  impression_write as (
    insert into public.feed_impressions(
      tracking_id,
      article_id,
      user_id,
      first_shown_at,
      last_shown_at,
      shown_count,
      previous_shown_count,
      previous_last_shown_at,
      current_feed_session_id,
      current_session_shown_count
    )
    select
      params.tracking_key,
      selected.original_id,
      auth.uid(),
      now(),
      now(),
      1,
      0,
      null,
      params.feed_session_id,
      1
    from selected cross join params
    where params.tracking_key is not null
    on conflict (tracking_id, article_id) do update set
      previous_shown_count = case
        when public.feed_impressions.current_feed_session_id = excluded.current_feed_session_id
          then public.feed_impressions.previous_shown_count
        else public.feed_impressions.shown_count
      end,
      previous_last_shown_at = case
        when public.feed_impressions.current_feed_session_id = excluded.current_feed_session_id
          then public.feed_impressions.previous_last_shown_at
        else public.feed_impressions.last_shown_at
      end,
      current_feed_session_id = excluded.current_feed_session_id,
      current_session_shown_count = case
        when public.feed_impressions.current_feed_session_id = excluded.current_feed_session_id
          then public.feed_impressions.current_session_shown_count + 1
        else 1
      end,
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
      selected.feed_position,
      selected.final_score,
      jsonb_build_object(
        'version', '2.0',
        'track', selected.track,
        'trackPosition', selected.track_position,
        'base', selected.base_score,
        'freshness', selected.freshness_multiplier,
        'personalization', selected.personalization_multiplier,
        'seenPenalty', selected.seen_multiplier
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
      when selected.effective_shown_count is null or selected.effective_shown_count = 0 then 'unseen'
      else 'fallback'
    end
  from selected
  cross join (select count(*) from impression_write) impression_barrier
  cross join (select count(*) from log_write) log_barrier
  order by selected.feed_position;
$$;

revoke all on function public.get_ranked_feed_v2(text, text, integer, integer, text, text) from public;
grant execute on function public.get_ranked_feed_v2(text, text, integer, integer, text, text)
  to anon, authenticated;
