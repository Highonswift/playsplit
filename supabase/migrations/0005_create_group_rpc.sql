-- PlaySplit — atomic group creation. Creating a group and returning it via RLS
-- is a chicken-and-egg (the creator isn't a member until after insert), so do
-- both in one SECURITY DEFINER call: create the group + enrol the owner as admin.

create or replace function create_group(p_name text, p_sport text default 'cricket')
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g groups;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if length(trim(p_name)) < 2 then
    raise exception 'Group name too short' using errcode = 'check_violation';
  end if;

  insert into groups (name, sport, owner_id)
  values (trim(p_name), p_sport, uid)
  returning * into g;

  insert into group_members (group_id, user_id, role, status)
  values (g.id, uid, 'group_admin', 'active');

  return g;
end;
$$;

grant execute on function create_group(text, text) to authenticated;
