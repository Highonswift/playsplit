'use server';

import { revalidatePath } from 'next/cache';
import { rupeesToPaise } from '@playsplit/core';
import { createClient } from '@/lib/supabase/server';
import { getActiveGroup } from '@/lib/groups';

export interface ActionState {
  error?: string;
  ok?: boolean;
}

/** Admin-only: add a ground (venue) with its standard hourly rate. */
export async function createGroundAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim() || null;
  const contact = String(formData.get('contact') ?? '').trim() || null;
  const hourlyRupees = Number(formData.get('hourly_rate') ?? 0);
  if (name.length < 2) return { error: 'Ground name must be at least 2 characters.' };
  if (!(hourlyRupees > 0)) return { error: 'Enter a valid hourly rate.' };

  const group = await getActiveGroup();
  if (!group) return { error: 'No active group.' };
  if (group.role === 'player') return { error: 'Only group admins can add grounds.' };

  const supabase = await createClient();
  const { error } = await supabase.from('grounds').insert({
    group_id: group.id,
    name,
    address,
    contact_person: contact,
    hourly_rate_paise: rupeesToPaise(hourlyRupees),
  });
  if (error) return { error: error.message };

  revalidatePath('/grounds');
  return { ok: true };
}

/** Admin-only: purchase a subscription (prepaid hours with a validity window). */
export async function createSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const groundId = String(formData.get('ground_id') ?? '');
  const costRupees = Number(formData.get('cost') ?? 0);
  const hours = Number(formData.get('hours') ?? 0);
  const validityDays = Number(formData.get('validity_days') ?? 0);
  const startDate = String(formData.get('start_date') ?? '') || new Date().toISOString().slice(0, 10);

  if (name.length < 2) return { error: 'Subscription name is required.' };
  if (!groundId) return { error: 'Select a ground.' };
  if (!(costRupees > 0)) return { error: 'Enter a valid cost.' };
  if (!(hours > 0)) return { error: 'Enter included hours.' };
  if (!(validityDays > 0)) return { error: 'Enter validity in days.' };

  const group = await getActiveGroup();
  if (!group) return { error: 'No active group.' };
  if (group.role === 'player') return { error: 'Only group admins can buy subscriptions.' };

  const costPaise = rupeesToPaise(costRupees);
  const ratePerHourPaise = Math.round(costPaise / hours);
  const end = new Date(startDate + 'T00:00:00Z');
  end.setUTCDate(end.getUTCDate() + validityDays);
  const endDate = end.toISOString().slice(0, 10);

  const supabase = await createClient();
  const { error } = await supabase.from('subscriptions').insert({
    group_id: group.id,
    ground_id: groundId,
    name,
    cost_paise: costPaise,
    purchased_hours: hours,
    consumed_hours: 0,
    rate_per_hour_paise: ratePerHourPaise,
    start_date: startDate,
    end_date: endDate,
    status: 'green',
  });
  if (error) return { error: error.message };

  revalidatePath('/grounds');
  revalidatePath('/dashboard');
  return { ok: true };
}
