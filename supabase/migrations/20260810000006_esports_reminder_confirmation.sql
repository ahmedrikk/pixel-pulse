create or replace function public.notify_esports_reminder()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into notifications(user_id,type,title,message,link,unique_key,available_at)
  values(new.user_id,'esports_reminder','Reminder Set',new.match_title||' was added to your esports reminders.','/esports','esports-reminder-set:'||new.match_id,now())
  on conflict do nothing;

  insert into notifications(user_id,type,title,message,link,unique_key,available_at)
  values(new.user_id,'esports_reminder','Esports Match Starting Soon',new.match_title||' starts soon.','/esports','esports-reminder-due:'||new.match_id,case when new.starts_at is null then now() else greatest(now(),new.starts_at-interval '15 minutes') end)
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.remove_cancelled_esports_reminder()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  delete from notifications
  where user_id=old.user_id
    and unique_key='esports-reminder-due:'||old.match_id
    and available_at > now();
  return old;
end;
$$;

drop trigger if exists remove_esports_reminder_notification on public.esports_reminders;
create trigger remove_esports_reminder_notification after delete on public.esports_reminders for each row execute function public.remove_cancelled_esports_reminder();
