-- Pace website article ingestion throughout the day while preserving the
-- existing hard limit of 100 published website articles per rolling 24 hours.
create table if not exists public.news_ingestion_budget (
  budget_key text primary key,
  tokens numeric not null check (tokens >= 0),
  capacity numeric not null check (capacity > 0),
  refill_per_hour numeric not null check (refill_per_hour > 0),
  last_refilled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.news_ingestion_budget enable row level security;

insert into public.news_ingestion_budget (
  budget_key,
  tokens,
  capacity,
  refill_per_hour,
  last_refilled_at,
  updated_at
)
values ('rss_articles', 2, 10, 100.0 / 24.0, now(), now())
on conflict (budget_key) do update
set capacity = excluded.capacity,
    refill_per_hour = excluded.refill_per_hour,
    tokens = least(public.news_ingestion_budget.tokens, excluded.capacity),
    updated_at = now();

create or replace function public.claim_news_ingestion_budget(
  p_requested integer,
  p_rolling_count integer,
  p_rolling_cap integer default 100
)
returns table (granted_slots integer, tokens_remaining numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  budget public.news_ingestion_budget%rowtype;
  refilled_tokens numeric;
  rolling_room integer;
  granted integer;
begin
  select * into budget
  from public.news_ingestion_budget
  where budget_key = 'rss_articles'
  for update;

  if not found then
    raise exception 'RSS ingestion budget is not configured';
  end if;

  refilled_tokens := least(
    budget.capacity,
    budget.tokens + greatest(0, extract(epoch from (now() - budget.last_refilled_at)))
      / 3600.0 * budget.refill_per_hour
  );
  rolling_room := greatest(0, coalesce(p_rolling_cap, 100) - greatest(0, coalesce(p_rolling_count, 0)));
  granted := least(
    greatest(0, coalesce(p_requested, 0)),
    floor(refilled_tokens)::integer,
    rolling_room
  );

  update public.news_ingestion_budget
  set tokens = refilled_tokens - granted,
      last_refilled_at = now(),
      updated_at = now()
  where budget_key = 'rss_articles';

  return query select granted, refilled_tokens - granted;
end;
$$;

revoke all on public.news_ingestion_budget from anon, authenticated;
revoke all on function public.claim_news_ingestion_budget(integer, integer, integer) from public;
grant execute on function public.claim_news_ingestion_budget(integer, integer, integer) to service_role;
