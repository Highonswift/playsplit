import { computeInnings, requiredRunRate, type Ball, type InningsState } from '@playsplit/cricket';
import { createClient } from '@/lib/supabase/server';

export interface PlayerRef {
  id: string;
  full_name: string;
  role: string;
  is_shared?: boolean;
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
  deliveryCount: number;
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

/** A pickup match's squad for one side (from cricket_match_players, incl. shared). */
export async function getMatchSquad(matchId: string, teamId: string): Promise<PlayerRef[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cricket_match_players')
    .select('is_shared, batting_order, player:player_id(id, full_name, role)')
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .order('batting_order', { ascending: true, nullsFirst: false });
  return (data ?? [])
    .filter((r) => r.player)
    .map((r) => {
      const p = r.player as unknown as { id: string; full_name: string; role: string };
      return { id: p.id, full_name: p.full_name, role: p.role, is_shared: r.is_shared };
    });
}

/** Batting/bowling candidates for a side — squad for pickup, team roster otherwise. */
export async function getSidePlayers(
  matchId: string,
  teamId: string,
  isPickup: boolean,
): Promise<PlayerRef[]> {
  return isPickup ? getMatchSquad(matchId, teamId) : getTeamPlayerRefs(teamId);
}

/** Everything the scoring screen needs for a match's current innings. */
export async function getScoringData(
  matchId: string,
  playersPerSide: number,
  maxOvers: number | null,
  isPickup = false,
  lastManStands = false,
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
      deliveryCount: 0,
    };
  }

  const [{ data: deliveries }, battingPlayers, bowlingPlayers] = await Promise.all([
    supabase
      .from('cricket_deliveries')
      .select('seq, bowler_id, runs_bat, extra, extra_runs, wicket_type, wicket_out_end, wicket_fielder_id, wicket_incoming_id, wicket_crossed')
      .eq('innings_id', innings.id)
      .order('seq', { ascending: true }),
    getSidePlayers(matchId, innings.batting_team_id, isPickup),
    getSidePlayers(matchId, innings.bowling_team_id, isPickup),
  ]);

  // For pickup games sides vary in size (and may be uneven), so the "all out"
  // threshold must follow the actual batting squad, not a fixed number.
  const effectivePerSide = isPickup && battingPlayers.length > 0 ? battingPlayers.length : playersPerSide;

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
      playersPerSide: effectivePerSide,
      lastManStands,
    },
    balls,
  );

  // An innings can be closed manually (declaration / agreed short innings /
  // no over-limit set) via end_innings, which sets status='complete'. The
  // engine only derives completion from deliveries, so honour the persisted
  // status here — otherwise the scoring pad never closes and the "Start 2nd
  // innings" form (gated on state.complete) never appears.
  if (innings.status === 'complete') {
    state.complete = true;
    state.strikerId = null;
    state.nonStrikerId = null;
  }

  const names: Record<string, string> = {};
  for (const p of [...battingPlayers, ...bowlingPlayers]) names[p.id] = p.full_name;

  let rrr: number | null = null;
  let ballsRemaining: number | null = null;
  if (innings.target != null && maxOvers != null) {
    ballsRemaining = maxOvers * 6 - state.legalBalls;
    rrr = requiredRunRate(innings.target, state.totalRuns, ballsRemaining);
  }

  return {
    innings, allInnings, state, names, battingPlayers, bowlingPlayers,
    requiredRunRate: rrr, ballsRemaining, deliveryCount: balls.length,
  };
}

export interface InningsCard {
  number: number;
  battingTeamId: string;
  bowlingTeamId: string;
  target: number | null;
  state: InningsState;
  names: Record<string, string>;
  battingSquad: { id: string; full_name: string }[];
}

/**
 * Full computed state for EVERY innings of a match — so the scorecard can show
 * both innings (Cricbuzz-style tabs), not just the one in progress.
 */
export async function getInningsCards(
  matchId: string,
  playersPerSide: number,
  maxOvers: number | null,
  isPickup = false,
  lastManStands = false,
): Promise<InningsCard[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('cricket_innings')
    .select('id, number, batting_team_id, bowling_team_id, striker_id, non_striker_id, target, status')
    .eq('match_id', matchId)
    .order('number', { ascending: true });
  const inningsRows = (rows ?? []) as InningsRow[];

  return Promise.all(
    inningsRows.map(async (innings) => {
      const [{ data: deliveries }, battingPlayers, bowlingPlayers] = await Promise.all([
        supabase
          .from('cricket_deliveries')
          .select('seq, bowler_id, runs_bat, extra, extra_runs, wicket_type, wicket_out_end, wicket_fielder_id, wicket_incoming_id, wicket_crossed')
          .eq('innings_id', innings.id)
          .order('seq', { ascending: true }),
        getSidePlayers(matchId, innings.batting_team_id, isPickup),
        getSidePlayers(matchId, innings.bowling_team_id, isPickup),
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

      const effectivePerSide = isPickup && battingPlayers.length > 0 ? battingPlayers.length : playersPerSide;
      const state = computeInnings(
        {
          battingTeamId: innings.batting_team_id,
          bowlingTeamId: innings.bowling_team_id,
          strikerId: innings.striker_id,
          nonStrikerId: innings.non_striker_id,
          maxOvers,
          playersPerSide: effectivePerSide,
          lastManStands,
        },
        balls,
      );
      if (innings.status === 'complete') {
        state.complete = true;
        state.strikerId = null;
        state.nonStrikerId = null;
      }

      const names: Record<string, string> = {};
      for (const p of [...battingPlayers, ...bowlingPlayers]) names[p.id] = p.full_name;

      return {
        number: innings.number,
        battingTeamId: innings.batting_team_id,
        bowlingTeamId: innings.bowling_team_id,
        target: innings.target,
        state,
        names,
        battingSquad: battingPlayers.map((p) => ({ id: p.id, full_name: p.full_name })),
      };
    }),
  );
}
