-- Editorial queue for turning high-engagement news into community sentiment prompts.
create table if not exists public.hub_sentiment_candidates (
  id uuid primary key default gen_random_uuid(),
  article_id text not null unique,
  article_title text not null,
  comment_count integer not null default 0,
  status text not null default 'suggested' check (status in ('suggested', 'approved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hub_sentiment_candidates enable row level security;

-- This queue is intentionally private. Editors/service-role processes review a
-- candidate before creating a public hub_sentiment_questions row.
create or replace function public.flag_sentiment_candidate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  active_comments integer;
  article_title_value text;
begin
  select count(*) into active_comments
  from public.article_comments
  where article_id = new.article_id and deleted_at is null;

  if active_comments < 10 then return new; end if;

  select title into article_title_value
  from public.cached_articles
  where original_id = new.article_id
  order by fetched_at desc
  limit 1;

  if article_title_value is null then return new; end if;

  insert into public.hub_sentiment_candidates(article_id, article_title, comment_count)
  values (new.article_id, article_title_value, active_comments)
  on conflict (article_id) do update
    set comment_count = excluded.comment_count, updated_at = now();
  return new;
end;
$$;

drop trigger if exists article_comments_flag_sentiment_candidate on public.article_comments;
create trigger article_comments_flag_sentiment_candidate
after insert or update of deleted_at on public.article_comments
for each row execute function public.flag_sentiment_candidate();

comment on table public.hub_sentiment_candidates is
  'Private editorial review queue. High-comment news is suggested here but never auto-published.';
