-- Talus Operations dashboard: role gate, safe read model, moderation actions,
-- configurable settings, and immutable audit history.

alter table public.profiles add column if not exists is_admin boolean not null default false;
update public.profiles p
set is_admin = true
from auth.users u
where p.id = u.id and lower(u.email) in ('ahmedrikk@gmail.com', 'aashaykr1809@gmail.com');

create or replace function public.is_talus_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and is_admin); $$;
revoke all on function public.is_talus_admin() from public, anon;
grant execute on function public.is_talus_admin() to authenticated, service_role;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
alter table public.admin_audit_log enable row level security;
create policy "admins read audit history" on public.admin_audit_log for select to authenticated using (public.is_talus_admin());
revoke insert, update, delete on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;

create table if not exists public.admin_dashboard_settings (
  key text primary key,
  value jsonb not null,
  description text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.admin_dashboard_settings(key,value,description) values
  ('summary_word_range','{"min":60,"max":70}', 'Target range for news briefs'),
  ('free_offer_stale_hours','2', 'Hours before an unconfirmed offer is treated as stale'),
  ('dashboard_refresh_seconds','60', 'Operations dashboard refresh interval')
on conflict (key) do nothing;
alter table public.admin_dashboard_settings enable row level security;
create policy "admins read dashboard settings" on public.admin_dashboard_settings for select to authenticated using (public.is_talus_admin());
revoke insert, update, delete on public.admin_dashboard_settings from anon, authenticated;
grant select on public.admin_dashboard_settings to authenticated;

create or replace function public.get_talus_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public, auth, cron
as $$
declare result jsonb;
begin
  if not public.is_talus_admin() then raise exception 'Access denied' using errcode = '42501'; end if;
  select jsonb_build_object(
    'generatedAt', now(),
    'overview', jsonb_build_object(
      'articlesToday', (select count(*) from public.cached_articles where media_type <> 'youtube' and created_at >= date_trunc('day', now())),
      'videosToday', (select count(*) from public.cached_articles where media_type = 'youtube' and created_at >= date_trunc('day', now())),
      'activeFreeGames', (select count(*) from public.free_game_offers where status = 'active'),
      'upcomingFreeGames', (select count(*) from public.free_game_offers where status = 'upcoming'),
      'patchesToday', (select count(*) from public.game_patches where created_at >= date_trunc('day', now())),
      'gamesTotal', (select count(*) from public.games),
      'gamesComplete', (select count(*) from public.games where description_status = 'ready' and release_date is not null and cover_image is not null),
      'pendingDescriptions', (select count(*) from public.game_description_submissions where status = 'pending'),
      'apiFailures24h', (select count(*) from public.api_usage_events where occurred_at >= now()-interval '24 hours' and not success),
      'usersTotal', (select count(*) from public.profiles),
      'systemStatus', case when exists(select 1 from public.api_usage_events where occurred_at >= now()-interval '1 hour' and not success) then 'degraded' else 'healthy' end
    ),
    'news', coalesce((select jsonb_agg(to_jsonb(x)) from (select source, media_type, count(*) total, max(created_at) last_published from public.cached_articles where created_at >= now()-interval '7 days' group by source,media_type order by count(*) desc) x),'[]'),
    'recentContent', coalesce((select jsonb_agg(to_jsonb(x)) from (select id,source,media_type,coalesce(ai_title,title) title,left(coalesce(ai_summary,summary),220) summary,created_at from public.cached_articles order by created_at desc limit 30) x),'[]'),
    'youtubeSources', coalesce((select jsonb_agg(to_jsonb(x)) from (select id,source_name,active,last_polled_at,poll_interval_minutes,quota_units_used_today from public.youtube_content_sources order by source_name) x),'[]'),
    'games', coalesce((select jsonb_agg(to_jsonb(x)) from (select id,name,slug,description_status,image_status,release_date,review_count,trending,updated_at from public.games order by trending desc nulls last,review_count desc limit 100) x),'[]'),
    'freeGames', coalesce((select jsonb_agg(to_jsonb(x)) from (select id,game_id,source_name,store_name,status,ends_at,last_seen_at,updated_at from public.free_game_offers order by updated_at desc limit 100) x),'[]'),
    'patches', coalesce((select jsonb_agg(to_jsonb(x)) from (select id,game_id,title,published_at,editorial_status,editorial_error,created_at from public.game_patches order by created_at desc limit 100) x),'[]'),
    'moderation', coalesce((select jsonb_agg(to_jsonb(x)) from (select s.id,s.game_id,g.name game_name,s.user_id,s.description,s.status,s.created_at from public.game_description_submissions s join public.games g on g.id=s.game_id order by s.created_at desc limit 100) x),'[]'),
    'users', coalesce((select jsonb_agg(to_jsonb(x)) from (select p.id,p.username,p.display_name,p.account_status,p.onboarding_completed,p.is_admin,p.created_at,u.last_sign_in_at,case when u.email is null then null else left(u.email,2)||'***@'||split_part(u.email,'@',2) end masked_email from public.profiles p left join auth.users u on u.id=p.id order by p.created_at desc limit 100) x),'[]'),
    'usage', coalesce((select jsonb_agg(to_jsonb(x)) from (select provider,service,operation,count(*) requests,count(*) filter(where success) successes,count(*) filter(where not success) failures,coalesce(sum(total_tokens),0) total_tokens,avg(latency_ms)::integer average_latency_ms,max(occurred_at) last_request_at from public.api_usage_events where occurred_at>=now()-interval '24 hours' group by provider,service,operation order by count(*) desc) x),'[]'),
    'jobs', coalesce((select jsonb_agg(to_jsonb(x)) from (select jobid,jobname,schedule,active from cron.job order by jobname) x),'[]'),
    'pacingRuns', coalesce((select jsonb_agg(to_jsonb(x)) from (select slot_started_at,granted_allowance,published_count,completed_at from public.news_pacing_runs order by slot_started_at desc limit 48) x),'[]'),
    'settings', coalesce((select jsonb_agg(to_jsonb(x)) from (select key,value,description,updated_at from public.admin_dashboard_settings order by key) x),'[]'),
    'audit', coalesce((select jsonb_agg(to_jsonb(x)) from (select id,actor_id,action,entity_type,entity_id,details,created_at from public.admin_audit_log order by created_at desc limit 100) x),'[]')
  ) into result;
  return result;
end; $$;
revoke all on function public.get_talus_admin_dashboard() from public, anon;
grant execute on function public.get_talus_admin_dashboard() to authenticated, service_role;

create or replace function public.admin_moderate_game_description(p_submission_id uuid,p_decision text,p_notes text default null,p_edited_description text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_talus_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  update public.game_description_submissions set status=p_decision,reviewer_id=auth.uid(),reviewer_notes=left(p_notes,1000),description=coalesce(nullif(trim(p_edited_description),''),description),reviewed_at=now(),updated_at=now() where id=p_submission_id and status='pending';
  if not found then raise exception 'Submission unavailable'; end if;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'moderate', 'game_description',p_submission_id::text,jsonb_build_object('decision',p_decision));
end; $$;
revoke all on function public.admin_moderate_game_description(uuid,text,text,text) from public, anon;
grant execute on function public.admin_moderate_game_description(uuid,text,text,text) to authenticated;

create or replace function public.admin_update_dashboard_setting(p_key text,p_value jsonb)
returns void language plpgsql security definer set search_path=public
as $$ begin
  if not public.is_talus_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  update public.admin_dashboard_settings set value=p_value,updated_by=auth.uid(),updated_at=now() where key=p_key;
  if not found then raise exception 'Unknown setting'; end if;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'update','setting',p_key,jsonb_build_object('value',p_value));
end; $$;
revoke all on function public.admin_update_dashboard_setting(text,jsonb) from public, anon;
grant execute on function public.admin_update_dashboard_setting(text,jsonb) to authenticated;
