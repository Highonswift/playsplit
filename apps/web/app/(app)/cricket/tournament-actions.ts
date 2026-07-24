'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveGroup } from '@/lib/groups';

export interface Result {
  error?: string;
  ok?: boolean;
}

async function adminGroup() {
  const group = await getActiveGroup();
  if (!group) return { error: 'No active group.' as const };
  if (group.role === 'player') return { error: 'Only group admins can manage tournaments.' as const };
  return { group };
}

export async function createTournamentAction(_p: Result, formData: FormData): Promise<Result> {
  const name = String(formData.get('name') ?? '').trim();
  const format = String(formData.get('format') ?? 'league');
  if (name.length < 2) return { error: 'Tournament name is required.' };
  const res = await adminGroup();
  if ('error' in res) return { error: res.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ group_id: res.group.id, name, format })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Could not create tournament.' };
  redirect(`/cricket/tournaments/${data.id}`);
}

export async function registerTeamAction(_p: Result, formData: FormData): Promise<Result> {
  const tournamentId = String(formData.get('tournament_id') ?? '');
  const teamId = String(formData.get('team_id') ?? '');
  if (!teamId) return { error: 'Pick a team.' };
  const res = await adminGroup();
  if ('error' in res) return { error: res.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from('tournament_teams')
    .insert({ tournament_id: tournamentId, team_id: teamId });
  if (error) return { error: error.code === '23505' ? 'Team already registered.' : error.message };
  revalidatePath(`/cricket/tournaments/${tournamentId}`);
  return { ok: true };
}
