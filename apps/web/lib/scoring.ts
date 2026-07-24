import { computeInnings, requiredRunRate, type Ball, type InningsState } from '@playsplit/cricket';
import { createClient } from '@/lib/supabase/server';

export interface PlayerRef {
  id: string;
  full_name: string;
  role: string;
}

export interface InningsRow {
  id: string;
  number: number;
  batting_team_id: string;
  bowling_team_id: string;
  striker_id: string;
  non_striker_id: string;
  target: number | null;
  status: string;
}

export interface ScoringData {
  innings: InningsRow | null;
  allInnings: InningsRow[];
  state: InningsState | null;
  names: Record<string, string>;
  battingPlayers: PlayerRef[];
  bowlingPlayers: PlayerRef[];
  requiredRunRate: number | null;
  ballsRemaining: number | null;
}

export async function getTeamPlayerRefs(teamId: string): Promise<PlayerRef[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cricket_players')
    .select('id, full_name, role')
    .eq('team_id', teamId)
    .order('jersey_number', { ascending: true, nullsFirst: false });
  return (data ?? []) as PlayerRef[];
}

/** Everything the scoring screen needs for a match's current innings. */
export async function getScoringData(
  matchId: string,
  playersPerSide: number,
  maxOvers: number | null,
): Promise<ScoringData> {
  const supabase = await createClient();

  const { data: inningsRows } = await supabase
    .from('cricket_innings')
    .select('id, number, batting_team_id, bowling_team_id, striker_id, non_striker_id, target, status')
    .eq('match_id', matchId)
    .order('number', { ascending: true });

  const allInnings = (inningsRows ?? []) as InningsRow[];
  const innings = allInnings.length > 0 ? allInnings[allInnings.length - 1]! : null;

  if (!innings) {
    return {
      innings: null, allInnings, state: null, names: {},
      battingPlayers: [], bowlingPlayers: [], requiredRunRate: null, ballsRemaining: null,
    };
  }

  const [{ data: deliveries }, battingPlayers, bowlingPlayers] = await Promise.all([
    supabase
      .from('cricket_deliveries')
      .select('seq, bowler_id, runs_bat, extra, extra_runs, wicket_type, wicket_out_end, wicket_fielder_id, wicket_incoming_id, wicket_crossed')
      .eq('innings_id', innings.id)
      .order('seq', { ascending: true }),
    getTeamPlayerRefs(innings.batting_team_id),
    getTeamPlayerRefs(innings.bowling_team_id),
  ]);

  const balls: Ball[] = (deliveries ?? []).map((d) => ({
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
          crossed: d.wicket_crossed,
        }
      : null,
  }));

  const state = computeInnings(
    {
      battingTeamId: innings.batting_team_id,
      bowlingTeamId: innings.bowling_team_id,
      strikerId: innings.striker_id,
      nonStrikerId: innings.non_striker_id,
      maxOvers,
      playersPerSide,
    },
    balls,
  );

  const names: Record<string, string> = {};
  for (const p of [...battingPlayers, ...bowlingPlayers]) names[p.id] = p.full_name;

  let rrr: number | null = null;
  let ballsRemaining: number | null = null;
  if (innings.target != null && maxOvers != null) {
    ballsRemaining = maxOvers * 6 - state.legalBalls;
    rrr = requiredRunRate(innings.target, state.totalRuns, ballsRemaining);
  }

  return { innings, allInnings, state, names, battingPlayers, bowlingPlayers, requiredRunRate: rrr, ballsRemaining };
}
