'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveGroup } from '@/lib/groups';
import type { CricketFormat, CricketRole } from '@/lib/cricket-types';

export interface ActionState {
  error?: string;
  ok?: boolean;
}

async function adminGroup() {
  const group = await getActiveGroup();
  if (!group) return { error: 'No active group.' as const };
  if (group.role === 'player') return { error: 'Only group admins can manage cricket.' as const };
  return { group };
}

/** Create a cricket team (§6.1). */
export async function createTeamAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const shortName = String(formData.get('short_name') ?? '').trim().toUpperCase() || null;
  const color = String(formData.get('color') ?? '#16a34a');
  const city = String(formData.get('city') ?? '').trim() || null;
  if (name.length < 2) return { error: 'Team name must be at least 2 characters.' };

  const res = await adminGroup();
  if ('error' in res) return { error: res.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cricket_teams')
    .insert({ group_id: res.group.id, name, short_name: shortName, color, city })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Could not create team.' };
  redirect(`/cricket/teams/${data.id}`);
}

/** Add a player to a team (§6.2). */
export async function addPlayerAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  const teamId = String(formData.get('team_id') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();
  const jersey = formData.get('jersey_number') ? Number(formData.get('jersey_number')) : null;
  const role = String(formData.get('role') ?? 'batter') as CricketRole;
  const batting = String(formData.get('batting') ?? 'rhb');
  const bowling = String(formData.get('bowling') ?? 'none');
  if (!teamId) return { error: 'Missing team.' };
  if (fullName.length < 2) return { error: 'Player name is required.' };

  const res = await adminGroup();
  if ('error' in res) return { error: res.error };

  const supabase = await createClient();
  const { error } = await supabase.from('cricket_players').insert({
    group_id: res.group.id,
    team_id: teamId,
    full_name: fullName,
    jersey_number: jersey,
    role,
    batting,
    bowling,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cricket/teams/${teamId}`);
  return { ok: true };
}

const FORMAT_DEFAULT_OVERS: Partial<Record<CricketFormat, number>> = {
  t20: 20, odi: 50, t10: 10, hundred: 100, box: 6, tennis: 8,
};

/** Create a cricket match between two teams (§7). */
export async function createMatchAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get('name') ?? '').trim() || null;
  const format = String(formData.get('format') ?? 't20') as CricketFormat;
  const teamA = String(formData.get('team_a_id') ?? '');
  const teamB = String(formData.get('team_b_id') ?? '');
  const venue = String(formData.get('venue') ?? '').trim() || null;
  const matchDate = String(formData.get('match_date') ?? '') || new Date().toISOString().slice(0, 10);
  const playersPerSide = Number(formData.get('players_per_side') ?? 11);
  const oversRaw = formData.get('overs');
  const overs = oversRaw ? Number(oversRaw) : (FORMAT_DEFAULT_OVERS[format] ?? null);

  if (!teamA || !teamB) return { error: 'Pick both teams.' };
  if (teamA === teamB) return { error: 'The two teams must be different.' };

  const res = await adminGroup();
  if ('error' in res) return { error: res.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cricket_matches')
    .insert({
      group_id: res.group.id,
      name,
      format,
      overs: format === 'unlimited' || format === 'test' ? null : overs,
      innings: format === 'test' ? 2 : 1,
      players_per_side: playersPerSide,
      team_a_id: teamA,
      team_b_id: teamB,
      venue,
      match_date: matchDate,
      status: 'scheduled',
    })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Could not create match.' };
  redirect(`/cricket/matches/${data.id}`);
}

/** Record the toss and set who bats first (§7.1). */
export async function recordTossAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  const matchId = String(formData.get('match_id') ?? '');
  const winnerId = String(formData.get('toss_winner_team_id') ?? '');
  const decision = String(formData.get('toss_decision') ?? 'bat') as 'bat' | 'bowl';
  if (!matchId || !winnerId) return { error: 'Select the toss winner and decision.' };

  const res = await adminGroup();
  if ('error' in res) return { error: res.error };

  const supabase = await createClient();
  const { data: match } = await supabase
    .from('cricket_matches')
    .select('team_a_id, team_b_id')
    .eq('id', matchId)
    .single();
  if (!match) return { error: 'Match not found.' };

  const other = winnerId === match.team_a_id ? match.team_b_id : match.team_a_id;
  const battingFirst = decision === 'bat' ? winnerId : other;

  const { error } = await supabase
    .from('cricket_matches')
    .update({
      toss_winner_team_id: winnerId,
      toss_decision: decision,
      batting_first_team_id: battingFirst,
      toss_at: new Date().toISOString(),
      status: 'toss',
    })
    .eq('id', matchId);
  if (error) return { error: error.message };
  revalidatePath(`/cricket/matches/${matchId}`);
  return { ok: true };
}
