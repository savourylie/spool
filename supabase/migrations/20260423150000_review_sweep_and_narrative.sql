-- ============================================================
-- Spool: Review Sweep + Narrative (TICKET-074)
-- ============================================================
-- Adds the `narrative` column to post_predictions and registers
-- the hourly /api/reviews/sweep cron. The sweep endpoint mutates
-- rows, so it is invoked over HTTP POST via a new
-- `private.invoke_app_cron_post` helper that mirrors the existing
-- GET-based `private.invoke_app_cron` from the original scheduler
-- migration.

alter table post_predictions add column narrative text;

create or replace function private.invoke_app_cron_post(route_path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_base_url text;
  cron_secret text;
  normalized_base_url text;
begin
  app_base_url := private.get_vault_secret('cron_app_base_url');
  cron_secret := private.get_vault_secret('cron_secret');

  if app_base_url is null or btrim(app_base_url) = '' then
    raise warning 'Spool cron skipped: vault secret "cron_app_base_url" is missing.';
    return null;
  end if;

  if cron_secret is null or btrim(cron_secret) = '' then
    raise warning 'Spool cron skipped: vault secret "cron_secret" is missing.';
    return null;
  end if;

  normalized_base_url := regexp_replace(app_base_url, '/+$', '');

  return net.http_post(
    url := normalized_base_url || route_path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 600000
  );
end;
$$;

create or replace function private.trigger_review_sweep()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select private.invoke_app_cron_post('/api/reviews/sweep');
$$;

revoke all on function private.invoke_app_cron_post(text) from public;
revoke all on function private.invoke_app_cron_post(text) from anon;
revoke all on function private.invoke_app_cron_post(text) from authenticated;

revoke all on function private.trigger_review_sweep() from public;
revoke all on function private.trigger_review_sweep() from anon;
revoke all on function private.trigger_review_sweep() from authenticated;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'spool-review-sweep'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'spool-review-sweep',
    '0 * * * *',
    'select private.trigger_review_sweep();'
  );
end;
$$;
