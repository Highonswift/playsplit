-- PitchLive — Distribute control of pickup games.
-- Any member who has CLAIMED their pool player can start and score pickup games
-- (not just admins). Pool roster editing stays admin-only. Standard (named-team)
-- matches are unchanged — still admin/official only.

-- Helper: has the caller claimed a pool player in this group?
create or replace function has_claimed_player(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cricket_players cp
    where cp.group_id = p_group and cp.user_id = auth.uid() and cp.team_id is null
  );
$$;

-- Scoring rights: admins (any match), assigned officials (any match), and — for
-- pickup games — any member who has claimed their player.
create or replace function can_score_match(p_match uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cricket_matches m
    where m.id = p_match and (
      is_group_admin(m.group_id)
      or (m.match_type = 'pickup' and has_claimed_player(m.group_id))
    )
  )
  or exists (
    select 1 from cricket_officials o
    where o.match_id = p_match and o.user_id = auth.uid() and o.can_score
  );
$$;

-- Starting a pickup game: admins OR members who've claimed their player.
create or replace function create_pickup_match(
  p_group        uuid,
  p_side_a_name  text,
  p_side_b_name  text,
  p_side_a       uuid[],
  p_side_b       uuid[],
  p_shared       uuid[],
  p_overs        int,
  p_match_date   date,
  p_venue        text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team_a uuid; v_team_b uuid; v_match uuid;
  v_per_side int; v_pid uuid; v_ord int;
begin
  if not (is_group_admin(p_group) or has_claimed_player(p_group)) then
    raise exception 'Only admins or members who have claimed their player can start a game'
      using errcode = '42501';
  end if;

  insert into cricket_teams (group_id, name, short_name, color, created_by)
    values (p_group, coalesce(nullif(p_side_a_name, ''), 'Side A'),
            upper(left(coalesce(nullif(p_side_a_name, ''), 'Side A'), 3)), '#16a34a', auth.uid())
    returning id into v_team_a;
  insert into cricket_teams (group_id, name, short_name, color, created_by)
    values (p_group, coalesce(nullif(p_side_b_name, ''), 'Side B'),
            upper(left(coalesce(nullif(p_side_b_name, ''), 'Side B'), 3)), '#2563eb', auth.uid())
    returning id into v_team_b;

  v_per_side := greatest(
    coalesce(array_length(p_side_a, 1), 0),
    coalesce(array_length(p_side_b, 1), 0)
  ) + coalesce(array_length(p_shared, 1), 0);

  insert into cricket_matches (
    group_id, name, format, overs, players_per_side, match_type,
    team_a_id, team_b_id, venue, match_date, status, created_by
  ) values (
    p_group, 'Pickup game', 'custom', p_overs, greatest(v_per_side, 2), 'pickup',
    v_team_a, v_team_b, p_venue, p_match_date, 'scheduled', auth.uid()
  ) returning id into v_match;

  v_ord := 0;
  foreach v_pid in array coalesce(p_side_a, '{}') loop
    v_ord := v_ord + 1;
    insert into cricket_match_players (match_id, team_id, player_id, batting_order)
      values (v_match, v_team_a, v_pid, v_ord);
  end loop;

  v_ord := 0;
  foreach v_pid in array coalesce(p_side_b, '{}') loop
    v_ord := v_ord + 1;
    insert into cricket_match_players (match_id, team_id, player_id, batting_order)
      values (v_match, v_team_b, v_pid, v_ord);
  end loop;

  foreach v_pid in array coalesce(p_shared, '{}') loop
    insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
      values (v_match, v_team_a, v_pid, 99, true);
    insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
      values (v_match, v_team_b, v_pid, 99, true);
  end loop;

  return v_match;
end; $$;

-- Toss via RPC (gated on scoring rights) so non-admin scorers can run their
-- pickup game end-to-end. Direct cricket_matches writes stay admin-only (RLS).
create or replace function record_toss(p_match uuid, p_winner uuid, p_decision toss_decision)
returns void language plpgsql security definer set search_path = public as $$
declare v_a uuid; v_b uuid; v_first uuid;
begin
  if not can_score_match(p_match) then raise exception 'Not authorized' using errcode = '42501'; end if;
  select team_a_id, team_b_id into v_a, v_b from cricket_matches where id = p_match;
  if v_a is null then raise exception 'Match not found'; end if;
  v_first := case when p_decision = 'bat' then p_winner
                  when p_winner = v_a then v_b else v_a end;
  update cricket_matches set
    toss_winner_team_id = p_winner, toss_decision = p_decision,
    batting_first_team_id = v_first, toss_at = now(), status = 'toss'
  where id = p_match;
end; $$;

grant execute on function has_claimed_player(uuid) to authenticated, service_role;
grant execute on function record_toss(uuid, uuid, toss_decision) to authenticated, service_role;
