-- PitchLive — Cricket foundation (Enhancement Phase 2).
-- New cricket domain that coexists with the existing cost-sharing tables; the
-- old "matches" remain booking/attendance sessions, "cricket_matches" are
-- Team A vs Team B games that Phase 3 will score ball-by-ball.

create type cricket_format as enum
  ('t20', 'odi', 't10', 'hundred', 'test', 'custom', 'box', 'tennis', 'unlimited');

create type cricket_match_status as enum
  ('scheduled', 'toss', 'live', 'innings_break', 'completed', 'abandoned', 'cancelled');

create type toss_decision as enum ('bat', 'bowl');

create type cricket_role as enum ('batter', 'bowler', 'allrounder', 'wk', 'wk_batter');
create type batting_style as enum ('rhb', 'lhb');
create type bowling_style as enum
  ('right_fast', 'right_medium', 'right_offspin', 'right_legspin',
   'left_fast', 'left_medium', 'left_orthodox', 'left_wrist', 'none');

-- ----------------------------------------------------------------------------
-- Teams (§6.1)
-- ----------------------------------------------------------------------------
create table cricket_teams (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  name        text not null,
  short_name  text,
  color       text default '#16a34a',
  city        text,
  logo_url    text,
  description text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index idx_cricket_teams_group on cricket_teams(group_id);

-- ----------------------------------------------------------------------------
-- Players (§6.2). Standalone records — a cricket player need not be an app user.
-- ----------------------------------------------------------------------------
create table cricket_players (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  team_id       uuid references cricket_teams(id) on delete set null,
  user_id       uuid references profiles(id),   -- optional link to an app user
  full_name     text not null,
  jersey_number int,
  role          cricket_role not null default 'batter',
  batting       batting_style default 'rhb',
  bowling       bowling_style default 'none',
  created_at    timestamptz not null default now()
);
create index idx_cricket_players_group on cricket_players(group_id);
create index idx_cricket_players_team on cricket_players(team_id);

-- ----------------------------------------------------------------------------
-- Matches (§7) with toss (§7.1). Formats are config on the row (§5.2).
-- ----------------------------------------------------------------------------
create table cricket_matches (
  id                uuid primary key default gen_random_uuid(),
  group_id          uuid not null references groups(id) on delete cascade,
  name              text,
  format            cricket_format not null default 't20',
  overs             int,               -- null = unlimited
  innings           int not null default 1,
  players_per_side  int not null default 11,
  max_overs_per_bowler int,
  ball_type         text default 'leather',
  team_a_id         uuid not null references cricket_teams(id),
  team_b_id         uuid not null references cricket_teams(id),
  venue             text,
  match_date        date not null,
  start_time        time,
  visibility        text not null default 'private',
  status            cricket_match_status not null default 'scheduled',
  -- toss
  toss_winner_team_id  uuid references cricket_teams(id),
  toss_decision        toss_decision,
  batting_first_team_id uuid references cricket_teams(id),
  toss_at              timestamptz,
  -- result (populated in Phase 3)
  winner_team_id       uuid references cricket_teams(id),
  result_text          text,
  player_of_match_id   uuid references cricket_players(id),
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now(),
  check (team_a_id <> team_b_id)
);
create index idx_cricket_matches_group_date on cricket_matches(group_id, match_date);

-- ----------------------------------------------------------------------------
-- Match squads / playing XI (§6.3)
-- ----------------------------------------------------------------------------
create table cricket_match_players (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references cricket_matches(id) on delete cascade,
  team_id        uuid not null references cricket_teams(id) on delete cascade,
  player_id      uuid not null references cricket_players(id) on delete cascade,
  is_playing_xi  boolean not null default true,
  is_captain     boolean not null default false,
  is_wicketkeeper boolean not null default false,
  batting_order  int,
  unique (match_id, player_id)
);
create index idx_cmp_match on cricket_match_players(match_id);

-- ----------------------------------------------------------------------------
-- RLS — group-scoped; members read, admins write.
-- ----------------------------------------------------------------------------
alter table cricket_teams          enable row level security;
alter table cricket_players        enable row level security;
alter table cricket_matches        enable row level security;
alter table cricket_match_players  enable row level security;

create policy ct_select on cricket_teams for select using (is_group_member(group_id));
create policy ct_write  on cricket_teams for all using (is_group_admin(group_id)) with check (is_group_admin(group_id));

create policy cp_select on cricket_players for select using (is_group_member(group_id));
create policy cp_write  on cricket_players for all using (is_group_admin(group_id)) with check (is_group_admin(group_id));

create policy cm_select on cricket_matches for select using (is_group_member(group_id));
create policy cm_write  on cricket_matches for all using (is_group_admin(group_id)) with check (is_group_admin(group_id));

create policy cmp_select on cricket_match_players for select
  using (exists (select 1 from cricket_matches m where m.id = match_id and is_group_member(m.group_id)));
create policy cmp_write on cricket_match_players for all
  using (exists (select 1 from cricket_matches m where m.id = match_id and is_group_admin(m.group_id)))
  with check (exists (select 1 from cricket_matches m where m.id = match_id and is_group_admin(m.group_id)));

-- Grants (RLS still gates rows).
grant select, insert, update, delete on
  cricket_teams, cricket_players, cricket_matches, cricket_match_players to authenticated;
grant select on
  cricket_teams, cricket_players, cricket_matches, cricket_match_players to anon;
grant all on
  cricket_teams, cricket_players, cricket_matches, cricket_match_players to service_role;
