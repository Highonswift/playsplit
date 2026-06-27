'use server';

import { revalidatePath } from 'next/cache';
import { rupeesToPaise } from '@playsplit/core';
import { createClient } from '@/lib/supabase/server';
import { getActiveGroup } from '@/lib/groups';

export interface ActionState {
  error?: string;
  ok?: boolean;
}

const METHODS = ['cash', 'upi', 'bank_transfer'];

/** Admin records a manual (cash/UPI/bank) payment that credits a member's wallet. */
export async function recordManualPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = String(formData.get('user_id') ?? '');
  const amountRupees = Number(formData.get('amount') ?? 0);
  const method = String(formData.get('method') ?? 'cash');
  if (!userId) return { error: 'Select a member.' };
  if (!(amountRupees > 0)) return { error: 'Enter a valid amount.' };
  if (!METHODS.includes(method)) return { error: 'Invalid method.' };

  const group = await getActiveGroup();
  if (!group) return { error: 'No active group.' };
  if (group.role === 'player') return { error: 'Only group admins can record payments.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_payment', {
    p_group: group.id,
    p_user: userId,
    p_amount: rupeesToPaise(amountRupees),
    p_method: method,
  });
  if (error) return { error: error.message };

  revalidatePath('/wallet');
  revalidatePath('/dashboard');
  return { ok: true };
}

export interface RazorpayOrder {
  error?: string;
  orderId?: string;
  amount?: number;
  keyId?: string;
}

/** Create a Razorpay order for the signed-in user to pay down their balance. */
export async function createRazorpayOrderAction(amountPaise: number): Promise<RazorpayOrder> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId.includes('placeholder')) {
    return { error: 'Razorpay is not configured. Ask an admin to record the payment manually.' };
  }
  if (!(amountPaise > 0)) return { error: 'Nothing to pay.' };

  const group = await getActiveGroup();
  if (!group) return { error: 'No active group.' };

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      notes: { group_id: group.id },
    }),
  });
  if (!res.ok) return { error: 'Could not create payment order.' };
  const order = (await res.json()) as { id: string; amount: number };
  return { orderId: order.id, amount: order.amount, keyId };
}
