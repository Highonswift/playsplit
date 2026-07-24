'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface DeliveryPayload {
  bowlerId: string;
  runsBat: number;
  extra: string | null;
  extraRuns: number;
  wicket: {
    type: string;
    outEnd: 'striker' | 'nonstriker';
    fielderId?: string | null;
    incomingBatterId?: string | null;
  } | null;
}

export interface Result {
  error?: string;
}

export async function startInningsAction(_prev: Result, formData: FormData): Promise<Result> {
  const matchId = String(formData.get('match_id') ?? '');
  const number = Number(formData.get('number') ?? 1);
  const battingTeam = String(formData.get('batting_team_id') ?? '');
  const bowlingTeam = String(formData.get('bowling_team_id') ?? '');
  const striker = String(formData.get('striker_id') ?? '');
  const nonStriker = String(formData.get('non_striker_id') ?? '');
  const target = formData.get('target') ? Number(formData.get('target')) : null;

  if (!striker || !nonStriker) return { error: 'Pick both opening batters.' };
  if (striker === nonStriker) return { error: 'Striker and non-striker must differ.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('start_innings', {
    p_match: matchId, p_number: number, p_batting: battingTeam, p_bowling: bowlingTeam,
    p_striker: striker, p_non_striker: nonStriker, p_target: target,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cricket/matches/${matchId}`);
  return {};
}

export async function recordDeliveryAction(
  matchId: string,
  inningsId: string,
  d: DeliveryPayload,
): Promise<Result> {
  if (!d.bowlerId) return { error: 'Select a bowler first.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_delivery', {
    p_innings: inningsId,
    p_bowler: d.bowlerId,
    p_runs_bat: d.runsBat,
    p_extra: d.extra,
    p_extra_runs: d.extraRuns,
    p_wicket_type: d.wicket?.type ?? null,
    p_wicket_out_end: d.wicket?.outEnd ?? null,
    p_wicket_fielder: d.wicket?.fielderId ?? null,
    p_wicket_incoming: d.wicket?.incomingBatterId ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cricket/matches/${matchId}`);
  return {};
}

export async function undoAction(matchId: string, inningsId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('undo_delivery', { p_innings: inningsId });
  if (error) return { error: error.message };
  revalidatePath(`/cricket/matches/${matchId}`);
  return {};
}

export async function endInningsAction(matchId: string, inningsId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('end_innings', { p_innings: inningsId });
  if (error) return { error: error.message };
  revalidatePath(`/cricket/matches/${matchId}`);
  return {};
}

export async function finishMatchAction(
  matchId: string,
  winnerTeamId: string | null,
  resultText: string,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('finish_match', {
    p_match: matchId, p_winner: winnerTeamId, p_result: resultText, p_pom: null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cricket/matches/${matchId}`);
  return {};
}
