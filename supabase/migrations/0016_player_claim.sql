-- PitchLive — Link a signed-up member to their pool player ("claim your player").
-- Pool players (cricket_players with team_id = null) are just names an admin
-- typed in. When the real person signs up, they claim that name so their login
-- maps to their on-field identity and stats. cricket_players.user_id (from 0011)
-- is the link. One player per user per group.

-- Member self-claim: link my account to an unclaimed pool player in my group.
create or replace function claim_pool_player(p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid; v_owner uuid;
begin
  select group_id, user_id into v_group, v_owner
    from cricket_players where id = p_player and team_id is null;
  if v_group is null then raise exception 'Player not found'; end if;
  if not is_group_member(v_group) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_owner is not null and v_owner <> auth.uid() then
    raise exception 'That player is already linked to another member';
  end if;
  -- One linked player per user per group: release any previous claim first.
  update cricket_players set user_id = null where group_id = v_group and user_id = auth.uid();
  update cricket_players set user_id = auth.uid() where id = p_player;
end; $$;

-- Admin override: link a pool player to any member, or unlink (p_user = null).
create or replace function set_player_account(p_player uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  select group_id into v_group from cricket_players where id = p_player;
  if v_group is null then raise exception 'Player not found'; end if;
  if not is_group_admin(v_group) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_user is not null then
    update cricket_players set user_id = null where group_id = v_group and user_id = p_user;
  end if;
  update cricket_players set user_id = p_user where id = p_player;
end; $$;

grant execute on function claim_pool_player(uuid) to authenticated, service_role;
grant execute on function set_player_account(uuid, uuid) to authenticated, service_role;
