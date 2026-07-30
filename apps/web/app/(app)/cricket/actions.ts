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
  const tournamentId = String(formData.get('tournament_id') ?? '') || null;
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
      tournament_id: tournamentId,
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

// ---------------------------------------------------------------------------
// Pickup cricket (Ariyalur mode): a group player pool + ad-hoc daily sides.
// ---------------------------------------------------------------------------

/** Add one or more names to the group's pickup pool (players with no team). */
export async function addPoolPlayersAction(names: string[]): Promise<ActionState> {
  const clean = names.map((n) => n.trim()).filter((n) => n.length >= 2);
  if (clean.length === 0) return { error: 'Enter at least one name.' };

  const res = await adminGroup();
  if ('error' in res) return { error: res.error };

  const supabase = await createClient();
  const { error } = await supabase.from('cricket_players').insert(
    clean.map((full_name) => ({ group_id: res.group.id, full_name, team_id: null })),
  );
  if (error) return { error: error.message };
  revalidatePath('/cricket/pool');
  revalidatePath('/cricket/pickup');
  return { ok: true };
}

/** Remove a pool player (only if they aren't tied to a team). */
export async function removePoolPlayerAction(playerId: string): Promise<ActionState> {
  const res = await adminGroup();
  if ('error' in res) return { error: res.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from('cricket_players')
    .delete()
    .eq('id', playerId)
    .eq('group_id', res.group.id)
    .is('team_id', null);
  if (error) return { error: error.message };
  revalidatePath('/cricket/pool');
  return { ok: true };
}

export interface PickupPayload {
  sideAName: string;
  sideBName: string;
  sideA: string[];
  sideB: string[];
  shared: string[];
  overs: number | null;
  venue?: string | null;
}

/** Spin up a whole pickup match (two sides + squads) in one call.
 *  Allowed for admins OR members who've claimed a player — the RPC enforces it. */
export async function createPickupMatchAction(p: PickupPayload): Promise<ActionState> {
  if (p.sideA.length === 0 || p.sideB.length === 0) {
    return { error: 'Both sides need at least one player.' };
  }
  const group = await getActiveGroup();
  if (!group) return { error: 'No active group.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_pickup_match', {
    p_group: group.id,
    p_side_a_name: p.sideAName || 'Side A',
    p_side_b_name: p.sideBName || 'Side B',
    p_side_a: p.sideA,
    p_side_b: p.sideB,
    p_shared: p.shared,
    p_overs: p.overs,
    p_match_date: new Date().toISOString().slice(0, 10),
    p_venue: p.venue ?? null,
  });
  if (error || !data) return { error: error?.message ?? 'Could not start the game.' };
  redirect(`/cricket/matches/${data}`);
}

/** Member self-links their account to an unclaimed pool player. */
export async function claimPlayerAction(playerId: string): Promise<ActionState> {
  if (!playerId) return { error: 'Pick your name.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('claim_pool_player', { p_player: playerId });
  if (error) return { error: error.message };
  revalidatePath('/settings');
  revalidatePath('/cricket/pool');
  return { ok: true };
}

/** Admin links a pool player to a member's account, or unlinks (userId=null). */
export async function setPlayerAccountAction(
  playerId: string,
  userId: string | null,
): Promise<ActionState> {
  const res = await adminGroup();
  if ('error' in res) return { error: res.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_player_account', {
    p_player: playerId,
    p_user: userId,
  });
  if (error) return { error: error.message };
  revalidatePath('/cricket/pool');
  return { ok: true };
}

/** Record the toss and set who bats first (§7.1). */
export async function recordTossAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  const matchId = String(formData.get('match_id') ?? '');
  const winnerId = String(formData.get('toss_winner_team_id') ?? '');
  const decision = String(formData.get('toss_decision') ?? 'bat') as 'bat' | 'bowl';
  if (!matchId || !winnerId) return { error: 'Select the toss winner and decision.' };

  // Gated on scoring rights (admin/official/claimed pickup member) via the RPC.
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_toss', {
    p_match: matchId,
    p_winner: winnerId,
    p_decision: decision,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cricket/matches/${matchId}`);
  return { ok: true };
}
