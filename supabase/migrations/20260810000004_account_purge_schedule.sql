create schema if not exists private;

create or replace function private.purge_expired_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare deleted_count integer;
begin
  delete from auth.users as account
  using public.profiles as profile
  where account.id = profile.id
    and profile.account_status = 'pending_deletion'
    and profile.scheduled_deletion_at is not null
    and profile.scheduled_deletion_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function private.purge_expired_accounts() from public, anon, authenticated;

create extension if not exists pg_cron schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname = 'purge-expired-talus-accounts';
select cron.schedule(
  'purge-expired-talus-accounts',
  '23 4 * * *',
  'select private.purge_expired_accounts();'
);
