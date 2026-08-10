alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists deactivated_at timestamptz,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists scheduled_deletion_at timestamptz;

do $$ begin
  alter table public.profiles add constraint profiles_account_status_check
    check (account_status in ('active', 'deactivated', 'pending_deletion'));
exception when duplicate_object then null;
end $$;

create or replace function public.request_account_action(p_action text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare result public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_action = 'deactivate' then
    update profiles set account_status = 'deactivated', deactivated_at = now(), deletion_requested_at = null, scheduled_deletion_at = null, updated_at = now() where id = auth.uid() returning * into result;
  elsif p_action = 'delete' then
    update profiles set account_status = 'pending_deletion', deletion_requested_at = now(), scheduled_deletion_at = now() + interval '30 days', updated_at = now() where id = auth.uid() returning * into result;
  elsif p_action = 'recover' then
    update profiles set account_status = 'active', deactivated_at = null, deletion_requested_at = null, scheduled_deletion_at = null, updated_at = now() where id = auth.uid() returning * into result;
  else
    raise exception 'Invalid account action';
  end if;
  return result;
end;
$$;

revoke all on function public.request_account_action(text) from public;
grant execute on function public.request_account_action(text) to authenticated;
