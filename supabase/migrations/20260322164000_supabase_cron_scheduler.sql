-- ============================================================
-- Spool: Supabase Cron Scheduler
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create or replace function private.get_vault_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from vault.decrypted_secrets as ds
  where ds.name = secret_name
  order by ds.created_at desc
  limit 1;
$$;

create or replace function private.invoke_app_cron(route_path text)
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

  return net.http_get(
    url := normalized_base_url || route_path,
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || cron_secret
    ),
    timeout_milliseconds := 600000
  );
end;
$$;

create or replace function private.trigger_metrics_refresh()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select private.invoke_app_cron('/api/cron/metrics');
$$;

create or replace function private.trigger_daily_refresh()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select private.invoke_app_cron('/api/cron/daily');
$$;

create or replace function private.trigger_token_refresh()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select private.invoke_app_cron('/api/cron/token-refresh');
$$;

revoke all on function private.get_vault_secret(text) from public;
revoke all on function private.get_vault_secret(text) from anon;
revoke all on function private.get_vault_secret(text) from authenticated;

revoke all on function private.invoke_app_cron(text) from public;
revoke all on function private.invoke_app_cron(text) from anon;
revoke all on function private.invoke_app_cron(text) from authenticated;

revoke all on function private.trigger_metrics_refresh() from public;
revoke all on function private.trigger_metrics_refresh() from anon;
revoke all on function private.trigger_metrics_refresh() from authenticated;

revoke all on function private.trigger_daily_refresh() from public;
revoke all on function private.trigger_daily_refresh() from anon;
revoke all on function private.trigger_daily_refresh() from authenticated;

revoke all on function private.trigger_token_refresh() from public;
revoke all on function private.trigger_token_refresh() from anon;
revoke all on function private.trigger_token_refresh() from authenticated;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname in (
      'spool-metrics-refresh',
      'spool-daily-refresh',
      'spool-token-refresh'
    )
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'spool-metrics-refresh',
    '0 */6 * * *',
    'select private.trigger_metrics_refresh();'
  );

  perform cron.schedule(
    'spool-daily-refresh',
    '0 6 * * *',
    'select private.trigger_daily_refresh();'
  );

  perform cron.schedule(
    'spool-token-refresh',
    '0 7 * * *',
    'select private.trigger_token_refresh();'
  );
end;
$$;
