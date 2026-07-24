-- PitchLive — Tournaments (Enhancement Phase 5, §16).

create table tournaments (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id) on delete cascade,
  name       text not null,
  format     text not null default 'league', -- league|knockout|round_robin|group_knockout|custom
  status     text not null default 'active',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_tournaments_group on tournaments(group_id);

create table tournament_teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id       uuid not null references cricket_teams(id) on delete cascade,
  unique (tournament_id, team_id)
);

alter table cricket_matches add column tournament_id uuid references tournaments(id) on delete set null;
create index idx_matches_tournament on cricket_matches(tournament_id);

alter table tournaments      enable row level security;
alter table tournament_teams enable row level security;

create policy t_select on tournaments for select using (is_group_member(group_id));
create policy t_write  on tournaments for all using (is_group_admin(group_id)) with check (is_group_admin(group_id));

create policy tt_select on tournament_teams for select
  using (exists (select 1 from tournaments t where t.id = tournament_id and is_group_member(t.group_id)));
create policy tt_write on tournament_teams for all
  using (exists (select 1 from tournaments t where t.id = tournament_id and is_group_admin(t.group_id)))
  with check (exists (select 1 from tournaments t where t.id = tournament_id and is_group_admin(t.group_id)));

grant select, insert, update, delete on tournaments, tournament_teams to authenticated;
grant select on tournaments, tournament_teams to anon;
grant all on tournaments, tournament_teams to service_role;
