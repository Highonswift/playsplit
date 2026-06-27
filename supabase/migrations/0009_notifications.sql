-- PlaySplit — notification creation (PRD §17). SECURITY DEFINER so an admin's
-- action (settling a match) can notify other members, who can then read only
-- their own notifications (RLS notifications_select).

create or replace function create_notification(
  p_user uuid,
  p_group uuid,
  p_type text,
  p_title text,
  p_body text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only members of the group can be notified, and only by a fellow member
  -- (or the trusted server). Keeps this from being abused as a generic inbox.
  if auth.uid() is not null and not exists (
    select 1 from group_members where group_id = p_group and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  insert into notifications (user_id, group_id, type, title, body)
  values (p_user, p_group, p_type, p_title, p_body);
end;
$$;

grant execute on function create_notification(uuid, uuid, text, text, text)
  to authenticated, service_role;
