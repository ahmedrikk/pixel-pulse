create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  message text not null default '',
  link text,
  image_url text,
  metadata jsonb not null default '{}'::jsonb,
  unique_key text,
  available_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists notifications_user_unique_key_idx on public.notifications(user_id, unique_key) where unique_key is not null;
create index if not exists notifications_user_available_idx on public.notifications(user_id, available_at desc);
alter table public.notifications enable row level security;
create policy "users read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "users update own notifications" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own notifications" on public.notifications for delete using (auth.uid() = user_id);

create table if not exists public.article_comment_votes (
  comment_id uuid not null references public.article_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('up','down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(comment_id, user_id)
);
alter table public.article_comment_votes enable row level security;
create policy "comment votes are readable" on public.article_comment_votes for select using (true);
create policy "users create own comment votes" on public.article_comment_votes for insert with check (auth.uid() = user_id);
create policy "users update own comment votes" on public.article_comment_votes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own comment votes" on public.article_comment_votes for delete using (auth.uid() = user_id);

create table if not exists public.esports_reminders (
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id text not null,
  match_title text not null,
  starts_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(user_id, match_id)
);
alter table public.esports_reminders enable row level security;
create policy "users manage own esports reminders" on public.esports_reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.notify_esports_reminder() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into notifications(user_id,type,title,message,link,unique_key,available_at)
  values(new.user_id,'esports_reminder','Esports Match Reminder',new.match_title||' starts soon.','/esports','esports-reminder:'||new.match_id,case when new.starts_at is null then now() else greatest(now(),new.starts_at-interval '15 minutes') end)
  on conflict do nothing;
  return new;
end $$;
create trigger create_esports_reminder_notification after insert on public.esports_reminders for each row execute function public.notify_esports_reminder();

create table if not exists public.game_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, game_id)
);
alter table public.game_follows enable row level security;
create policy "users manage own followed games" on public.game_follows for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.toggle_article_comment_vote(p_comment_id uuid, p_direction text)
returns void language plpgsql security definer set search_path = public as $$
declare current_direction text;
begin
  if auth.uid() is null or p_direction not in ('up','down') then raise exception 'Invalid vote'; end if;
  select direction into current_direction from article_comment_votes where comment_id=p_comment_id and user_id=auth.uid();
  if current_direction = p_direction then delete from article_comment_votes where comment_id=p_comment_id and user_id=auth.uid();
  else insert into article_comment_votes(comment_id,user_id,direction) values(p_comment_id,auth.uid(),p_direction)
    on conflict(comment_id,user_id) do update set direction=excluded.direction, updated_at=now(); end if;
end $$;
grant execute on function public.toggle_article_comment_vote(uuid,text) to authenticated;

create or replace function public.notify_article_comment_activity() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; actor_name text;
begin
  if new.parent_comment_id is null then return new; end if;
  select user_id into recipient from article_comments where id=new.parent_comment_id;
  if recipient is null or recipient=new.user_id then return new; end if;
  select coalesce(display_name,username,'A Talus player') into actor_name from profiles where id=new.user_id;
  insert into notifications(user_id,actor_id,type,title,message,link,unique_key) values(recipient,new.user_id,'comment_reply',actor_name||' replied to your comment',left(new.body,180),'/?article='||new.article_id,'article-reply:'||new.id) on conflict do nothing;
  return new;
end $$;
create trigger notify_article_comment_reply after insert on public.article_comments for each row execute function public.notify_article_comment_activity();

create or replace function public.notify_article_comment_vote() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; article text; actor_name text;
begin
  if new.direction <> 'up' then return new; end if;
  select user_id,article_id into recipient,article from article_comments where id=new.comment_id;
  if recipient is null or recipient=new.user_id then return new; end if;
  select coalesce(display_name,username,'A Talus player') into actor_name from profiles where id=new.user_id;
  insert into notifications(user_id,actor_id,type,title,message,link,unique_key) values(recipient,new.user_id,'comment_vote',actor_name||' upvoted your reply','Your contribution received an upvote.','/?article='||article,'article-vote:'||new.comment_id||':'||new.user_id) on conflict do nothing;
  return new;
end $$;
create trigger notify_article_comment_upvote after insert or update of direction on public.article_comment_votes for each row execute function public.notify_article_comment_vote();

create or replace function public.notify_review_activity() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; game text; actor_name text;
begin
  select user_id,game_id into recipient,game from user_game_reviews where id=new.review_id;
  if recipient is null or recipient=new.user_id then return new; end if;
  select coalesce(display_name,username,'A Talus player') into actor_name from profiles where id=new.user_id;
  if tg_table_name='game_review_comments' then
    insert into notifications(user_id,actor_id,type,title,message,link,unique_key) values(recipient,new.user_id,'review_reply',actor_name||' replied to your review',left(new.text,180),'/reviews/'||game,'review-reply:'||new.id) on conflict do nothing;
  elsif new.direction='up' then
    insert into notifications(user_id,actor_id,type,title,message,link,unique_key) values(recipient,new.user_id,'review_vote',actor_name||' upvoted your review','Your review received an upvote.','/reviews/'||game,'review-vote:'||new.review_id||':'||new.user_id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger notify_review_comment after insert on public.game_review_comments for each row execute function public.notify_review_activity();
create trigger notify_review_upvote after insert or update of direction on public.game_review_votes for each row execute function public.notify_review_activity();

create or replace function public.notify_free_game_drop() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status <> 'active' then return new; end if;
  insert into notifications(user_id,type,title,message,link,image_url,unique_key)
  select id,'free_game','A new free game just dropped',new.title||' is free to claim on '||new.store_name,'/free-games',new.image_url,'free-game:'||new.id from profiles where account_status='active' on conflict do nothing;
  return new;
end $$;
create trigger notify_new_free_game after insert on public.free_game_offers for each row execute function public.notify_free_game_drop();

create or replace function public.notify_followed_game_patch() returns trigger language plpgsql security definer set search_path=public as $$
declare game_name text; game_cover text;
begin
  select name,cover_image into game_name,game_cover from games where id=new.game_id;
  insert into notifications(user_id,type,title,message,link,image_url,unique_key)
  select user_id,'game_patch',game_name||' has a new patch',new.title,'/game-patch/'||new.game_id,coalesce(new.image_url,game_cover),'patch:'||new.id from game_follows where game_id=new.game_id on conflict do nothing;
  return new;
end $$;
create trigger notify_new_followed_patch after insert on public.game_patches for each row execute function public.notify_followed_game_patch();

create or replace function public.fanout_today_game_launches() returns integer language plpgsql security definer set search_path=public as $$
declare inserted integer;
begin
  insert into notifications(user_id,type,title,message,link,image_url,unique_key)
  select profile.id,'game_launch',game.name||' launches today','The game is now available. Open its Talus page for details.','/reviews/'||game.id,game.cover_image,'launch:'||game.id
  from profiles profile cross join games game where profile.account_status='active' and game.release_date=current_date::text on conflict do nothing;
  get diagnostics inserted=row_count; return inserted;
end $$;
select cron.unschedule(jobid) from cron.job where jobname='notify-game-launches';
select cron.schedule('notify-game-launches','5 9 * * *','select public.fanout_today_game_launches();');
