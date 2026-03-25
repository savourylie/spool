-- ============================================================
-- Spool: Register velocity refresh cron job (every 30 minutes)
-- ============================================================
-- The /api/cron/velocity endpoint was created in TICKET-029 but
-- never registered as a scheduled pg_cron job. This migration
-- adds the missing job so velocity metric snapshots are captured
-- automatically for recently published posts.

create or replace function private.trigger_velocity_refresh()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select private.invoke_app_cron('/api/cron/velocity');
$$;

revoke all on function private.trigger_velocity_refresh() from public;
revoke all on function private.trigger_velocity_refresh() from anon;
revoke all on function private.trigger_velocity_refresh() from authenticated;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'spool-velocity-refresh'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'spool-velocity-refresh',
    '*/30 * * * *',
    'select private.trigger_velocity_refresh();'
  );
end;
$$;
