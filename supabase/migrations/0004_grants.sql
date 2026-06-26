-- PlaySplit — role grants. RLS (migration 0002) restricts which ROWS each user
-- sees; these grants give the Supabase roles the base table privileges they need
-- for RLS to even be evaluated. Without them every query is "permission denied".

grant usage on schema public to anon, authenticated, service_role;

-- Authenticated users: full DML, but every table has RLS so rows stay scoped.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Apply the same defaults to any tables/functions added by later migrations.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;
