-- PitchLive — Cricket live scoring (Enhancement Phase 3, §8–13).
-- Deliveries are append-only; live state is DERIVED by the (unit-tested) engine,
-- exactly like the wallet ledger. Undo = drop the last delivery.

create table cricket_innings (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references cricket_matches(id) on delete cascade,
  number          int not null default 1,
  batting_team_id uuid not null references cricket_teams(id),
  bowling_team_id uuid not null references cricket_teams(id),
  striker_id      uuid not null references cricket_players(id),
  non_striker_id  uuid not null references cricket_players(id),
  target          int,
  status          text not null default 'in_progress', -- in_progress | complete
  created_at      timestamptz not null default now(),
  unique (match_id, number)
);
create index idx_innings_match on cricket_innings(match_id);

create table cricket_deliveries (
  id                 uuid primary key default gen_random_uuid(),
  innings_id         uuid not null references cricket_innings(id) on delete cascade,
  seq                int not null,
  bowler_id          uuid not null references cricket_players(id),
  runs_bat           int not null default 0,
  extra              text,               -- wide|noball|bye|legbye|penalty
  extra_runs         int not null default 0,
  wicket_type        text,
  wicket_out_end     text,               -- striker|nonstriker
  wicket_fielder_id  uuid references cricket_players(id),
  wicket_incoming_id uuid references cricket_players(id),
  wicket_crossed     boolean not null default false,
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  unique (innings_id, seq)
);
create index idx_deliveries_innings on cricket_deliveries(innings_id, seq);

alter table cricket_innings    enable row level security;
alter table cricket_deliveries enable row level security;

-- Read: any member of the match's group (spectators/players follow live).
create policy ci_select on cricket_innings for select
  using (exists (select 1 from cricket_matches m where m.id = match_id and is_group_member(m.group_id)));
create policy cd_select on cricket_deliveries for select
  using (exists (
    select 1 from cricket_innings i join cricket_matches m on m.id = i.match_id
    where i.id = innings_id and is_group_member(m.group_id)));

grant select on cricket_innings, cricket_deliveries to authenticated, anon;
grant all on cricket_innings, cricket_deliveries to service_role;

-- ----------------------------------------------------------------------------
-- Authorization helper: can this user score this match? (admin for now; Phase 4
-- adds per-match umpire assignment.)
-- ----------------------------------------------------------------------------
create or replace function can_score_match(p_match uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cricket_matches m
    where m.id = p_match and is_group_admin(m.group_id)
  );
$$;

create or replace function start_innings(
  p_match uuid, p_number int, p_batting uuid, p_bowling uuid,
  p_striker uuid, p_non_striker uuid, p_target int default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not can_score_match(p_match) then raise exception 'Not authorized' using errcode='42501'; end if;
  insert into cricket_innings (match_id, number, batting_team_id, bowling_team_id, striker_id, non_striker_id, target)
  values (p_match, p_number, p_batting, p_bowling, p_striker, p_non_striker, p_target)
  on conflict (match_id, number) do update set
    batting_team_id = excluded.batting_team_id, bowling_team_id = excluded.bowling_team_id,
    striker_id = excluded.striker_id, non_striker_id = excluded.non_striker_id, target = excluded.target
  returning id into v_id;
  update cricket_matches set status = 'live' where id = p_match;
  return v_id;
end; $$;

create or replace function record_delivery(
  p_innings uuid, p_bowler uuid, p_runs_bat int, p_extra text, p_extra_runs int,
  p_wicket_type text, p_wicket_out_end text, p_wicket_fielder uuid, p_wicket_incoming uuid
) returns int
language plpgsql security definer set search_path = public as $$
declare v_match uuid; v_seq int;
begin
  select match_id into v_match from cricket_innings where id = p_innings;
  if v_match is null then raise exception 'Innings not found'; end if;
  if not can_score_match(v_match) then raise exception 'Not authorized' using errcode='42501'; end if;
  select coalesce(max(seq), 0) + 1 into v_seq from cricket_deliveries where innings_id = p_innings;
  insert into cricket_deliveries (innings_id, seq, bowler_id, runs_bat, extra, extra_runs,
    wicket_type, wicket_out_end, wicket_fielder_id, wicket_incoming_id, created_by)
  values (p_innings, v_seq, p_bowler, coalesce(p_runs_bat,0), p_extra, coalesce(p_extra_runs,0),
    p_wicket_type, p_wicket_out_end, p_wicket_fielder, p_wicket_incoming, auth.uid());
  return v_seq;
end; $$;

create or replace function undo_delivery(p_innings uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_match uuid;
begin
  select match_id into v_match from cricket_innings where id = p_innings;
  if not can_score_match(v_match) then raise exception 'Not authorized' using errcode='42501'; end if;
  delete from cricket_deliveries where id = (
    select id from cricket_deliveries where innings_id = p_innings order by seq desc limit 1);
end; $$;

create or replace function end_innings(p_innings uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_match uuid;
begin
  select match_id into v_match from cricket_innings where id = p_innings;
  if not can_score_match(v_match) then raise exception 'Not authorized' using errcode='42501'; end if;
  update cricket_innings set status = 'complete' where id = p_innings;
  update cricket_matches set status = 'innings_break' where id = v_match;
end; $$;

create or replace function finish_match(p_match uuid, p_winner uuid, p_result text, p_pom uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_score_match(p_match) then raise exception 'Not authorized' using errcode='42501'; end if;
  update cricket_matches set status = 'completed', winner_team_id = p_winner,
    result_text = p_result, player_of_match_id = p_pom where id = p_match;
end; $$;

grant execute on function can_score_match(uuid) to authenticated, service_role;
grant execute on function start_innings(uuid,int,uuid,uuid,uuid,uuid,int) to authenticated, service_role;
grant execute on function record_delivery(uuid,uuid,int,text,int,text,text,uuid,uuid) to authenticated, service_role;
grant execute on function undo_delivery(uuid) to authenticated, service_role;
grant execute on function end_innings(uuid) to authenticated, service_role;
grant execute on function finish_match(uuid,uuid,text,uuid) to authenticated, service_role;
