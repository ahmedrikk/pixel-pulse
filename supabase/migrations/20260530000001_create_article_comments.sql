-- Persistent comments on news articles.
-- article_id is the article's stable original_id (NewsItem.id).
create table if not exists public.article_comments (
  id                uuid primary key default gen_random_uuid(),
  article_id        text not null,
  user_id           uuid references auth.users not null,
  parent_comment_id uuid references public.article_comments(id) on delete cascade,
  body              text not null check (char_length(body) between 1 and 2000),
  created_at        timestamptz default now(),
  edited_at         timestamptz,
  deleted_at        timestamptz
);

alter table public.article_comments enable row level security;

-- Anyone can read comments (so other users see them)
create policy "comments are publicly readable"
  on public.article_comments for select using (true);

-- Only the author can create their own comment
create policy "users insert own comments"
  on public.article_comments for insert
  with check (auth.uid() = user_id);

-- Only the author can edit / soft-delete their comment
create policy "users update own comments"
  on public.article_comments for update
  using (auth.uid() = user_id);

create index if not exists idx_article_comments_article
  on public.article_comments(article_id, created_at);
