import { createClient } from '@/lib/supabase/server';
import type { CricketTeam, CricketPlayer, TeamRef, CricketMatchView } from '@/lib/cricket-types';

export * from '@/lib/cricket-types';

export async function getTeams(groupId: string): Promise<CricketTeam[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cricket_teams')
    .select('id, name, short_name, color, city, cricket_players(count)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    short_name: t.short_name,
    color: t.color,
    city: t.city,
    player_count: (t.cricket_players as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}

export async function getTeam(teamId: string): Promise<CricketTeam | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cricket_teams')
    .select('id, name, short_name, color, city')
    .eq('id', teamId)
    .maybeSingle();
  return data as CricketTeam | null;
}

export async function getTeamPlayers(teamId: string): Promise<CricketPlayer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cricket_players')
    .select('id, team_id, full_name, jersey_number, role, batting, bowling')
    .eq('team_id', teamId)
    .order('jersey_number', { ascending: true, nullsFirst: false });
  return (data ?? []) as CricketPlayer[];
}

const MATCH_COLS =
  'id, name, format, overs, players_per_side, venue, match_date, start_time, status, toss_winner_team_id, toss_decision, batting_first_team_id, team_a:team_a_id(id,name,short_name,color), team_b:team_b_id(id,name,short_name,color)';

function mapMatch(m: Record<string, unknown>): CricketMatchView {
  return {
    ...(m as unknown as CricketMatchView),
    start_time: (m.start_time as string | null)?.slice(0, 5) ?? null,
    team_a: m.team_a as unknown as TeamRef,
    team_b: m.team_b as unknown as TeamRef,
  };
}

export async function getCricketMatches(groupId: string): Promise<CricketMatchView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cricket_matches')
    .select(MATCH_COLS)
    .eq('group_id', groupId)
    .order('match_date', { ascending: false });
  return (data ?? []).map((m) => mapMatch(m as Record<string, unknown>));
}

export async function getCricketMatch(matchId: string): Promise<CricketMatchView | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('cricket_matches').select(MATCH_COLS).eq('id', matchId).maybeSingle();
  return data ? mapMatch(data as Record<string, unknown>) : null;
}
