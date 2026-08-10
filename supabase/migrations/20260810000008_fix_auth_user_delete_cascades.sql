-- These two early tables predated the account-lifecycle feature and used the
-- PostgreSQL default (RESTRICT) for their auth-user relationships. Account
-- deletion must remove user-owned reviews/comments just like newer tables do.
alter table public.user_game_reviews
  drop constraint if exists user_game_reviews_user_id_fkey;

alter table public.user_game_reviews
  add constraint user_game_reviews_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.article_comments
  drop constraint if exists article_comments_user_id_fkey;

alter table public.article_comments
  add constraint article_comments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
