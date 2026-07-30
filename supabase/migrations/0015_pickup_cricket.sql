-- PitchLive — Pickup cricket (Ariyalur mode).
-- Turf groups don't have fixed teams: a pool of ~40 players, and on any given
-- day 8–14 turn up and split into two ad-hoc sides. Odd numbers get a "shared"
-- player who bats & fields for BOTH sides. Late arrivals join mid-match.
--
-- Design: a pickup match still creates two real cricket_teams rows (so all the
-- existing match / innings / delivery / result machinery keeps working), but
-- the playing sides are defined by cricket_match_players, drawn from the group
-- pool (cricket_players with team_id = null). Scoring reads the per-match squad
-- instead of a permanent team roster.

-- 1. Match type flag ---------------------------------------------------------
alter table cricket_matches
  add column if not exists match_type text not null default 'standard'
    check (match_type in ('standard', 'pickup'));

-- 2. Squad table: allow a shared player on both sides + track late joiners ----
alter table cricket_match_players
  add column if not exists is_shared boolean not null default false,
  add column if not exists joined_at timestamptz not null default now();

-- The old constraint (one row per player per match) blocks the shared player,
-- who must appear on both sides. Key on (match, player, team) instead.
alter table cricket_match_players drop constraint if exists cricket_match_players_match_id_player_id_key;
do $$ begin
  alter table cricket_match_players add constraint cmp_match_player_team_uniq unique (match_id, player_id, team_id);
exception when duplicate_object then null; end $$;

-- 3. Create a whole pickup match in one shot ---------------------------------
-- Makes two side-teams, the match, and the squads (shared players land on both
-- sides, flagged is_shared). Arrays carry pool player ids in batting order.
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
  if not is_group_admin(p_group) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into cricket_teams (group_id, name, short_name, color, created_by)
    values (p_group, coalesce(nullif(p_side_a_name, ''), 'Side A'),
            upper(left(coalesce(nullif(p_side_a_name, ''), 'Side A'), 3)), '#16a34a', auth.uid())
    returning id into v_team_a;
  insert into cricket_teams (group_id, name, short_name, color, created_by)
    values (p_group, coalesce(nullif(p_side_b_name, ''), 'Side B'),
            upper(left(coalesce(nullif(p_side_b_name, ''), 'Side B'), 3)), '#2563eb', auth.uid())
    returning id into v_team_b;

  -- Nominal players-per-side = larger squad incl. the shared player(s).
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

  -- Shared player(s) go on BOTH sides, batting last, flagged.
  foreach v_pid in array coalesce(p_shared, '{}') loop
    insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
      values (v_match, v_team_a, v_pid, 99, true);
    insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
      values (v_match, v_team_b, v_pid, 99, true);
  end loop;

  return v_match;
end; $$;

-- 4. Add a player to a side mid-match (late arrival) -------------------------
create or replace function add_match_player(
  p_match uuid, p_team uuid, p_player uuid, p_is_shared boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare v_next int;
begin
  if not can_score_match(p_match) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select coalesce(max(batting_order), 0) + 1 into v_next
    from cricket_match_players where match_id = p_match and team_id = p_team;

  insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
    values (p_match, p_team, p_player, v_next, p_is_shared)
    on conflict (match_id, player_id, team_id) do nothing;

  -- A shared late arrival joins the other side too.
  if p_is_shared then
    insert into cricket_match_players (match_id, team_id, player_id, batting_order, is_shared)
      select p_match, t.id, p_player, 99, true
        from cricket_matches m
        join cricket_teams t on t.id in (m.team_a_id, m.team_b_id)
       where m.id = p_match and t.id <> p_team
      on conflict (match_id, player_id, team_id) do nothing;
  end if;
end; $$;

grant execute on function create_pickup_match(uuid,text,text,uuid[],uuid[],uuid[],int,date,text) to authenticated, service_role;
grant execute on function add_match_player(uuid,uuid,uuid,boolean) to authenticated, service_role;
