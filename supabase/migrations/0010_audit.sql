-- PlaySplit — audit trail (PRD §24). SECURITY DEFINER so members can append
-- audit entries (audit_log has no direct insert policy); admins read them.

create or replace function log_audit(
  p_group uuid,
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (group_id, actor_id, action, entity, entity_id, after)
  values (p_group, auth.uid(), p_action, p_entity, p_entity_id, p_after);
end;
$$;

grant execute on function log_audit(uuid, text, text, uuid, jsonb) to authenticated, service_role;
