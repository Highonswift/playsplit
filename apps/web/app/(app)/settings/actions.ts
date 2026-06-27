'use server';

import { revalidatePath } from 'next/cache';
import type { CostModel } from '@playsplit/core';
import { createClient } from '@/lib/supabase/server';
import { getActiveGroup } from '@/lib/groups';

export interface ActionState {
  error?: string;
  ok?: boolean;
}

/** Any user updates their own display name (needed before group play). */
export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const fullName = String(formData.get('full_name') ?? '').trim();
  if (fullName.length < 2) return { error: 'Name must be at least 2 characters.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}

const MODELS: CostModel[] = ['equal', 'usage', 'investor', 'hybrid'];

/** Admin switches the group's cost-sharing model (applies to future matches). */
export async function updateCostModelAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const model = String(formData.get('cost_model') ?? '') as CostModel;
  if (!MODELS.includes(model)) return { error: 'Invalid model.' };

  const group = await getActiveGroup();
  if (!group) return { error: 'No active group.' };
  if (group.role === 'player') return { error: 'Only group admins can change the cost model.' };

  const supabase = await createClient();
  const { error } = await supabase.from('groups').update({ cost_model: model }).eq('id', group.id);
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  revalidatePath('/settings');
  return { ok: true };
}
