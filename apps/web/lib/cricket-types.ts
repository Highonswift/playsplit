// Pure cricket types & labels — safe to import from client OR server components
// (no next/headers or Supabase server imports here).

export type CricketFormat =
  | 't20' | 'odi' | 't10' | 'hundred' | 'test' | 'custom' | 'box' | 'tennis' | 'unlimited';
export type CricketRole = 'batter' | 'bowler' | 'allrounder' | 'wk' | 'wk_batter';
export type CricketMatchStatus =
  | 'scheduled' | 'toss' | 'live' | 'innings_break' | 'completed' | 'abandoned' | 'cancelled';

export interface CricketTeam {
  id: string;
  name: string;
  short_name: string | null;
  color: string;
  city: string | null;
  player_count?: number;
}

export interface CricketPlayer {
  id: string;
  team_id: string | null;
  full_name: string;
  jersey_number: number | null;
  role: CricketRole;
  batting: string | null;
  bowling: string | null;
}

export interface TeamRef {
  id: string;
  name: string;
  short_name: string | null;
  color: string;
}

export interface CricketMatchView {
  id: string;
  name: string | null;
  format: CricketFormat;
  overs: number | null;
  players_per_side: number;
  team_a: TeamRef;
  team_b: TeamRef;
  venue: string | null;
  match_date: string;
  start_time: string | null;
  status: CricketMatchStatus;
  toss_winner_team_id: string | null;
  toss_decision: 'bat' | 'bowl' | null;
  batting_first_team_id: string | null;
}

export const FORMAT_LABELS: Record<CricketFormat, string> = {
  t20: 'T20', odi: 'One Day', t10: 'T10', hundred: 'The Hundred', test: 'Test',
  custom: 'Custom', box: 'Box cricket', tennis: 'Tennis-ball', unlimited: 'Unlimited overs',
};

export const ROLE_LABELS: Record<CricketRole, string> = {
  batter: 'Batter', bowler: 'Bowler', allrounder: 'All-rounder',
  wk: 'Wicketkeeper', wk_batter: 'WK-Batter',
};
