import { computeInnings, type Ball } from '@playsplit/cricket';
import { createClient } from '@/lib/supabase/server';

export interface BattingStat {
  playerId: string; name: string; matches: number; innings: number;
  runs: number; balls: number; fours: number; sixes: number;
  hs: number; hsNotOut: boolean; notOuts: number; ducks: number;
  fifties: number; hundreds: number; average: number | null; strikeRate: number;
}
export interface BowlingStat {
  playerId: string; name: string; matches: number; innings: number;
  balls: number; runs: number; wickets: number; maidens: number;
  best: string; fourW: number; fiveW: number;
  average: number | null; economy: number; strikeRate: number | null;
}
export interface FieldingStat {
  playerId: string; name: string; catches: number; runOuts: number; stumpings: number;
}
export interface TeamStat {
  teamId: string; name: string; played: number; won: number; lost: number; tied: number; winPct: number;
}

export interface CricketStats {
  batting: BattingStat[];
  bowling: BowlingStat[];
  fielding: FieldingStat[];
  teams: TeamStat[];
}

const oversStr = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

/** Career stats for a group, aggregated across all innings via the scoring engine. */
export async function getCricketStats(groupId: string): Promise<CricketStats> {
  const supabase = await createClient();

  const { data: innings } = await supabase
    .from('cricket_innings')
    .select('id, match_id, batting_team_id, bowling_team_id, striker_id, non_striker_id, target, cricket_matches!inner(group_id, players_per_side, overs, status, winner_team_id, team_a_id, team_b_id)')
    .eq('cricket_matches.group_id', groupId);

  const inns = innings ?? [];
  const inningsIds = inns.map((i) => i.id);

  const [{ data: deliveries }, { data: players }, { data: teams }] = await Promise.all([
    inningsIds.length
      ? supabase
          .from('cricket_deliveries')
          .select('innings_id, seq, bowler_id, runs_bat, extra, extra_runs, wicket_type, wicket_out_end, wicket_fielder_id, wicket_incoming_id')
          .in('innings_id', inningsIds)
          .order('seq', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.from('cricket_players').select('id, full_name').eq('group_id', groupId),
    supabase.from('cricket_teams').select('id, name').eq('group_id', groupId),
  ]);

  const name = new Map((players ?? []).map((p) => [p.id, p.full_name] as const));
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name] as const));

  const byInnings = new Map<string, Ball[]>();
  for (const d of deliveries ?? []) {
    const arr = byInnings.get(d.innings_id) ?? [];
    arr.push({
      bowlerId: d.bowler_id,
      runsBat: Number(d.runs_bat),
      extra: d.extra as Ball['extra'],
      extraRuns: Number(d.extra_runs),
      wicket: d.wicket_type
        ? {
            type: d.wicket_type,
            outEnd: (d.wicket_out_end ?? 'striker') as 'striker' | 'nonstriker',
            fielderId: d.wicket_fielder_id ?? undefined,
            incomingBatterId: d.wicket_incoming_id ?? undefined,
          }
        : null,
    });
    byInnings.set(d.innings_id, arr);
  }

  const bat = new Map<string, BattingStat & { matchSet: Set<string> }>();
  const bowl = new Map<string, BowlingStat & { matchSet: Set<string>; bestW: number; bestR: number }>();
  const field = new Map<string, FieldingStat>();

  const getBat = (id: string) => {
    let a = bat.get(id);
    if (!a) { a = { playerId: id, name: name.get(id) ?? 'Player', matches: 0, innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0, hs: 0, hsNotOut: false, notOuts: 0, ducks: 0, fifties: 0, hundreds: 0, average: null, strikeRate: 0, matchSet: new Set() }; bat.set(id, a); }
    return a;
  };
  const getBowl = (id: string) => {
    let a = bowl.get(id);
    if (!a) { a = { playerId: id, name: name.get(id) ?? 'Player', matches: 0, innings: 0, balls: 0, runs: 0, wickets: 0, maidens: 0, best: '0/0', fourW: 0, fiveW: 0, average: null, economy: 0, strikeRate: null, matchSet: new Set(), bestW: -1, bestR: 0 }; bowl.set(id, a); }
    return a;
  };
  const getField = (id: string) => {
    let a = field.get(id);
    if (!a) { a = { playerId: id, name: name.get(id) ?? 'Player', catches: 0, runOuts: 0, stumpings: 0 }; field.set(id, a); }
    return a;
  };

  for (const inn of inns) {
    const match = inn.cricket_matches as unknown as { players_per_side: number; overs: number | null };
    const state = computeInnings(
      {
        battingTeamId: inn.batting_team_id, bowlingTeamId: inn.bowling_team_id,
        strikerId: inn.striker_id, nonStrikerId: inn.non_striker_id,
        maxOvers: match.overs, playersPerSide: match.players_per_side,
      },
      byInnings.get(inn.id) ?? [],
    );

    for (const b of state.batting) {
      if (b.balls > 0 || b.out) {
        const a = getBat(b.playerId);
        a.matchSet.add(inn.match_id); a.innings += 1;
        a.runs += b.runs; a.balls += b.balls; a.fours += b.fours; a.sixes += b.sixes;
        if (b.out) { if (b.runs === 0) a.ducks += 1; } else a.notOuts += 1;
        if (b.runs >= 100) a.hundreds += 1; else if (b.runs >= 50) a.fifties += 1;
        if (b.runs > a.hs) { a.hs = b.runs; a.hsNotOut = !b.out; } else if (b.runs === a.hs && !b.out) a.hsNotOut = true;
      }
      if (b.out && b.outFielderId) {
        const f = getField(b.outFielderId);
        if (b.dismissalType === 'caught') f.catches += 1;
        else if (b.dismissalType === 'stumped') f.stumpings += 1;
        else if (b.dismissalType === 'run_out') f.runOuts += 1;
      }
    }

    for (const bw of state.bowling) {
      if (bw.legalBalls > 0 || bw.wides > 0 || bw.noballs > 0) {
        const a = getBowl(bw.playerId);
        a.matchSet.add(inn.match_id); a.innings += 1;
        a.balls += bw.legalBalls; a.runs += bw.runs; a.wickets += bw.wickets; a.maidens += bw.maidens;
        if (bw.wickets >= 5) a.fiveW += 1; else if (bw.wickets >= 4) a.fourW += 1;
        if (bw.wickets > a.bestW || (bw.wickets === a.bestW && bw.runs < a.bestR)) { a.bestW = bw.wickets; a.bestR = bw.runs; a.best = `${bw.wickets}/${bw.runs}`; }
      }
    }
  }

  const batting = [...bat.values()].map((a) => {
    const dismissals = a.innings - a.notOuts;
    return { ...a, matches: a.matchSet.size, average: dismissals > 0 ? +(a.runs / dismissals).toFixed(2) : null, strikeRate: a.balls > 0 ? +((a.runs / a.balls) * 100).toFixed(2) : 0 };
  }).sort((x, y) => y.runs - x.runs);

  const bowling = [...bowl.values()].map((a) => ({
    ...a, matches: a.matchSet.size,
    average: a.wickets > 0 ? +(a.runs / a.wickets).toFixed(2) : null,
    economy: a.balls > 0 ? +((a.runs / a.balls) * 6).toFixed(2) : 0,
    strikeRate: a.wickets > 0 ? +(a.balls / a.wickets).toFixed(1) : null,
  })).sort((x, y) => y.wickets - x.wickets || x.economy - y.economy);

  const fielding = [...field.values()].sort((x, y) => (y.catches + y.runOuts + y.stumpings) - (x.catches + x.runOuts + x.stumpings));

  // Team records from completed matches.
  const teamAgg = new Map<string, TeamStat>();
  const getTeam = (id: string) => {
    let t = teamAgg.get(id);
    if (!t) { t = { teamId: id, name: teamName.get(id) ?? 'Team', played: 0, won: 0, lost: 0, tied: 0, winPct: 0 }; teamAgg.set(id, t); }
    return t;
  };
  const seenMatch = new Set<string>();
  for (const inn of inns) {
    const m = inn.cricket_matches as unknown as { status: string; winner_team_id: string | null; team_a_id: string; team_b_id: string };
    if (m.status !== 'completed' || seenMatch.has(inn.match_id)) continue;
    seenMatch.add(inn.match_id);
    const a = getTeam(m.team_a_id), b = getTeam(m.team_b_id);
    a.played += 1; b.played += 1;
    if (!m.winner_team_id) { a.tied += 1; b.tied += 1; }
    else if (m.winner_team_id === m.team_a_id) { a.won += 1; b.lost += 1; }
    else { b.won += 1; a.lost += 1; }
  }
  const teamsOut = [...teamAgg.values()].map((t) => ({ ...t, winPct: t.played > 0 ? +((t.won / t.played) * 100).toFixed(1) : 0 })).sort((x, y) => y.won - x.won);

  void oversStr;
  return { batting, bowling, fielding, teams: teamsOut };
}
