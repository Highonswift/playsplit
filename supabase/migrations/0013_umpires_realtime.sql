-- PitchLive — Multiple umpires, scoring control & real-time (Enhancement Phase 4, §11).

-- Match officials (§11.1). role: umpire1|umpire2|third_umpire|reserve|scorer|referee
create table cricket_officials (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references cricket_matches(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null,
  can_score  boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);
create index idx_officials_match on cricket_officials(match_id);

-- Who currently holds active scoring control (§11.4).
alter table cricket_matches add column scoring_control_user_id uuid references profiles(id);
alter table cricket_matches add column scoring_control_at timestamptz;

alter table cricket_officials enable row level security;
create policy co_select on cricket_officials for select
  using (exists (select 1 from cricket_matches m where m.id = match_id and is_group_member(m.group_id)));
grant select on cricket_officials to authenticated, anon;
grant all on cricket_officials to service_role;

-- Scoring is allowed for group admins OR assigned officials with can_score.
create or replace function can_score_match(p_match uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cricket_matches m where m.id = p_match and is_group_admin(m.group_id))
      or exists (select 1 from cricket_officials o
                 where o.match_id = p_match and o.user_id = auth.uid() and o.can_score);
$$;

create or replace function assign_official(p_match uuid, p_user uuid, p_role text, p_can_score boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  select group_id into v_group from cricket_matches where id = p_match;
  if not is_group_admin(v_group) then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into cricket_officials (match_id, user_id, role, can_score)
  values (p_match, p_user, p_role, p_can_score)
  on conflict (match_id, user_id) do update set role = excluded.role, can_score = excluded.can_score;
end; $$;

create or replace function remove_official(p_match uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  select group_id into v_group from cricket_matches where id = p_match;
  if not is_group_admin(v_group) then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from cricket_officials where match_id = p_match and user_id = p_user;
end; $$;

-- Transfer/claim scoring control (§11.4).
create or replace function take_control(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_score_match(p_match) then raise exception 'Not authorized' using errcode = '42501'; end if;
  update cricket_matches set scoring_control_user_id = auth.uid(), scoring_control_at = now() where id = p_match;
end; $$;

-- Re-define record_delivery: require the caller holds control, plus an optimistic
-- sequence check to prevent duplicate/concurrent ball entry (§11.3).
drop function if exists record_delivery(uuid,uuid,int,text,int,text,text,uuid,uuid);
create or replace function record_delivery(
  p_innings uuid, p_bowler uuid, p_runs_bat int, p_extra text, p_extra_runs int,
  p_wicket_type text, p_wicket_out_end text, p_wicket_fielder uuid, p_wicket_incoming uuid,
  p_expected_seq int default null
) returns int
language plpgsql security definer set search_path = public as $$
declare v_match uuid; v_seq int; v_control uuid;
begin
  select match_id into v_match from cricket_innings where id = p_innings;
  if v_match is null then raise exception 'Innings not found'; end if;
  if not can_score_match(v_match) then raise exception 'Not authorized' using errcode = '42501'; end if;

  -- Scoring control: the first scorer claims it; others must take control first.
  select scoring_control_user_id into v_control from cricket_matches where id = v_match;
  if v_control is null then
    update cricket_matches set scoring_control_user_id = auth.uid(), scoring_control_at = now() where id = v_match;
  elsif v_control <> auth.uid() then
    raise exception 'Another umpire holds scoring control' using errcode = '55006';
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from cricket_deliveries where innings_id = p_innings;
  if p_expected_seq is not null and p_expected_seq <> v_seq then
    raise exception 'Score changed — refresh and retry' using errcode = '40001';
  end if;

  insert into cricket_deliveries (innings_id, seq, bowler_id, runs_bat, extra, extra_runs,
    wicket_type, wicket_out_end, wicket_fielder_id, wicket_incoming_id, created_by)
  values (p_innings, v_seq, p_bowler, coalesce(p_runs_bat,0), p_extra, coalesce(p_extra_runs,0),
    p_wicket_type, p_wicket_out_end, p_wicket_fielder, p_wicket_incoming, auth.uid());
  return v_seq;
end; $$;

grant execute on function assign_official(uuid,uuid,text,boolean) to authenticated, service_role;
grant execute on function remove_official(uuid,uuid) to authenticated, service_role;
grant execute on function take_control(uuid) to authenticated, service_role;
grant execute on function record_delivery(uuid,uuid,int,text,int,text,text,uuid,uuid,int) to authenticated, service_role;

-- Real-time: publish scoring tables so spectators & other umpires update live (§11.3, §14).
alter publication supabase_realtime add table cricket_matches;
alter publication supabase_realtime add table cricket_innings;
alter publication supabase_realtime add table cricket_deliveries;
alter publication supabase_realtime add table cricket_officials;
