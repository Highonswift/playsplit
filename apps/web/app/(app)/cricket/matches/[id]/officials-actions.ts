'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface Result {
  error?: string;
  ok?: boolean;
}

export async function assignOfficialAction(_prev: Result, formData: FormData): Promise<Result> {
  const matchId = String(formData.get('match_id') ?? '');
  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? 'umpire1');
  const canScore = formData.get('can_score') === 'on';
  if (!userId) return { error: 'Pick a member.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('assign_official', {
    p_match: matchId, p_user: userId, p_role: role, p_can_score: canScore,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cricket/matches/${matchId}`);
  return { ok: true };
}

export async function removeOfficialAction(matchId: string, userId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_official', { p_match: matchId, p_user: userId });
  if (error) return { error: error.message };
  revalidatePath(`/cricket/matches/${matchId}`);
  return {};
}

export async function takeControlAction(matchId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('take_control', { p_match: matchId });
  if (error) return { error: error.message };
  revalidatePath(`/cricket/matches/${matchId}`);
  return {};
}
