import { computeInnings, type Ball } from '@playsplit/cricket';
import { createClient } from '@/lib/supabase/server';

export interface Tournament {
  id: string; name: string; format: string; status: string; team_count?: number;
}
export interface Standing {
  teamId: string; name: string; played: number; won: number; lost: number; tied: number;
  points: number; nrr: number;
}

export async function getTournaments(groupId: string): Promise<Tournament[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tournaments')
    .select('id, name, format, status, tournament_teams(count)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((t) => ({
    id: t.id, name: t.name, format: t.format, status: t.status,
    team_count: (t.tournament_teams as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('tournaments').select('id, name, format, status').eq('id', id).maybeSingle();
  return data as Tournament | null;
}

export async function getTournamentTeams(tournamentId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tournament_teams')
    .select('team_id, cricket_teams(id, name)')
    .eq('tournament_id', tournamentId);
  return (data ?? []).map((r) => {
    const t = r.cricket_teams as unknown as { id: string; name: string };
    return { id: t.id, name: t.name };
  });
}

/** Points table with Net Run Rate, computed from completed tournament matches. */
export async function getTournamentTable(tournamentId: string): Promise<Standing[]> {
  const supabase = await createClient();
  const teams = await getTournamentTeams(tournamentId);
  const table = new Map<string, Standing & { rf: number; of: number; ra: number; oa: number }>();
  for (const t of teams) table.set(t.id, { teamId: t.id, name: t.name, played: 0, won: 0, lost: 0, tied: 0, points: 0, nrr: 0, rf: 0, of: 0, ra: 0, oa: 0 });

  const { data: matches } = await supabase
    .from('cricket_matches')
    .select('id, status, winner_team_id, team_a_id, team_b_id, players_per_side, overs')
    .eq('tournament_id', tournamentId)
    .eq('status', 'completed');

  const matchList = matches ?? [];
  if (matchList.length > 0) {
    const { data: inns } = await supabase
      .from('cricket_innings')
      .select('id, match_id, batting_team_id, bowling_team_id, striker_id, non_striker_id')
      .in('match_id', matchList.map((m) => m.id));
    const inningsList = inns ?? [];
    const { data: dels } = inningsList.length
      ? await supabase
          .from('cricket_deliveries')
          .select('innings_id, seq, bowler_id, runs_bat, extra, extra_runs, wicket_type, wicket_out_end')
          .in('innings_id', inningsList.map((i) => i.id))
          .order('seq', { ascending: true })
      : { data: [] };

    const byInnings = new Map<string, Ball[]>();
    for (const d of dels ?? []) {
      const a = byInnings.get(d.innings_id) ?? [];
      a.push({ bowlerId: d.bowler_id, runsBat: Number(d.runs_bat), extra: d.extra as Ball['extra'], extraRuns: Number(d.extra_runs), wicket: d.wicket_type ? { type: d.wicket_type, outEnd: (d.wicket_out_end ?? 'striker') as 'striker' | 'nonstriker' } : null });
      byInnings.set(d.innings_id, a);
    }
    const matchById = new Map(matchList.map((m) => [m.id, m]));

    // Win/loss/points
    for (const m of matchList) {
      const a = table.get(m.team_a_id), b = table.get(m.team_b_id);
      if (!a || !b) continue;
      a.played += 1; b.played += 1;
      if (!m.winner_team_id) { a.tied += 1; b.tied += 1; a.points += 1; b.points += 1; }
      else if (m.winner_team_id === m.team_a_id) { a.won += 1; b.lost += 1; a.points += 2; }
      else { b.won += 1; a.lost += 1; b.points += 2; }
    }

    // Runs for/against with full-quota overs on all-out (standard NRR).
    for (const inn of inningsList) {
      const m = matchById.get(inn.match_id);
      if (!m) continue;
      const state = computeInnings(
        { battingTeamId: inn.batting_team_id, bowlingTeamId: inn.bowling_team_id, strikerId: inn.striker_id, nonStrikerId: inn.non_striker_id, maxOvers: m.overs, playersPerSide: m.players_per_side },
        byInnings.get(inn.id) ?? [],
      );
      const allOut = state.wickets >= m.players_per_side - 1;
      const overs = allOut && m.overs ? m.overs : state.legalBalls / 6;
      const bat = table.get(inn.batting_team_id), bowl = table.get(inn.bowling_team_id);
      if (bat) { bat.rf += state.totalRuns; bat.of += overs; }
      if (bowl) { bowl.ra += state.totalRuns; bowl.oa += overs; }
    }
  }

  return [...table.values()]
    .map((s) => ({
      teamId: s.teamId, name: s.name, played: s.played, won: s.won, lost: s.lost, tied: s.tied, points: s.points,
      nrr: +(((s.of > 0 ? s.rf / s.of : 0) - (s.oa > 0 ? s.ra / s.oa : 0)).toFixed(3)),
    }))
    .sort((x, y) => y.points - x.points || y.nrr - x.nrr);
}
