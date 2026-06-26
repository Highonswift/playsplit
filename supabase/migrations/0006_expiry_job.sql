-- PlaySplit — subscription expiry job (PRD §10).
-- Display status (green/yellow/red) is computed on read by the app via the core
-- engine. This job persists the TERMINAL transition: when a subscription's
-- validity has elapsed OR its hours are exhausted, mark it expired and book the
-- unused hours as `expired_hours` for the Savings / Expired-Hours reports.

create or replace function expire_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update subscriptions
  set status = 'expired',
      expired_hours = greatest(0, purchased_hours - consumed_hours)
  where status not in ('expired', 'gray')
    and (end_date < current_date or consumed_hours >= purchased_hours);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Schedule daily at 00:30 if pg_cron is available (Supabase hosted has it).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('playsplit-expire-subscriptions', '30 0 * * *',
      $cron$ select expire_subscriptions(); $cron$);
  end if;
end;
$$;
