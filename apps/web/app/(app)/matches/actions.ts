'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { settleMatch, type PlayerAttendance, type SubscriptionState } from '@playsplit/core';
import { createClient } from '@/lib/supabase/server';
import { getActiveGroup, getGroupMembers } from '@/lib/groups';

export interface ActionState {
  error?: string;
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh! * 60 + em!) - (sh! * 60 + sm!);
}

/** Admin-only: create a match and seed attendance rows for every member. */
export async function createMatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const matchDate = String(formData.get('match_date') ?? '');
  const start = String(formData.get('start_time') ?? '');
  const end = String(formData.get('end_time') ?? '');
  const groundId = String(formData.get('ground_id') ?? '');
  const subscriptionId = String(formData.get('subscription_id') ?? '') || null;

  if (!matchDate || !start || !end) return { error: 'Date, start and end time are required.' };
  if (!groundId) return { error: 'Select a ground.' };
  const duration = minutesBetween(start, end);
  if (duration <= 0) return { error: 'End time must be after start time.' };

  const group = await getActiveGroup();
  if (!group) return { error: 'No active group.' };
  if (group.role === 'player') return { error: 'Only group admins can create matches.' };

  const supabase = await createClient();
  const { data: match, error } = await supabase
    .from('matches')
    .insert({
      group_id: group.id,
      ground_id: groundId,
      subscription_id: subscriptionId,
      match_date: matchDate,
      start_time: start,
      end_time: end,
      duration_mins: duration,
      cost_model: group.cost_model,
      status: 'scheduled',
    })
    .select('id')
    .single();
  if (error || !match) return { error: error?.message ?? 'Could not create match.' };

  // Seed attendance rows so the admin can mark presence.
  const members = await getGroupMembers(group.id);
  await supabase.from('match_attendance').insert(
    members.map((m) => ({
      match_id: match.id,
      user_id: m.user_id,
      present: false,
      billable_minutes: 0,
    })),
  );

  redirect(`/matches/${match.id}`);
}

export interface AttendanceInput {
  userId: string;
  present: boolean;
  billableMinutes: number;
  isInvestor: boolean;
}

/** Admin-only: save the attendance grid for a match. */
export async function saveAttendanceAction(
  matchId: string,
  rows: AttendanceInput[],
): Promise<ActionState> {
  const supabase = await createClient();
  for (const r of rows) {
    const { error } = await supabase
      .from('match_attendance')
      .update({
        present: r.present,
        billable_minutes: r.present ? r.billableMinutes : 0,
        is_investor: r.isInvestor,
      })
      .eq('match_id', matchId)
      .eq('user_id', r.userId);
    if (error) return { error: error.message };
  }
  revalidatePath(`/matches/${matchId}`);
  return {};
}

/** Admin-only: run the settlement engine for a match and persist the result. */
export async function settleMatchAction(matchId: string): Promise<ActionState> {
  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select('id, group_id, ground_id, subscription_id, duration_mins, cost_model, grounds(hourly_rate_paise)')
    .eq('id', matchId)
    .single();
  if (!match) return { error: 'Match not found.' };

  const { data: att } = await supabase
    .from('match_attendance')
    .select('user_id, present, billable_minutes, is_investor')
    .eq('match_id', matchId)
    .eq('present', true);
  const attendance: PlayerAttendance[] = (att ?? []).map((a) => ({
    userId: a.user_id,
    billableMinutes: Number(a.billable_minutes),
    isInvestor: a.is_investor,
  }));
  if (attendance.length === 0) return { error: 'Mark at least one player present before settling.' };

  let subscription: SubscriptionState | null = null;
  if (match.subscription_id) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, rate_per_hour_paise, purchased_hours, consumed_hours, end_date')
      .eq('id', match.subscription_id)
      .single();
    if (sub) {
      subscription = {
        id: sub.id,
        ratePerHourPaise: Number(sub.rate_per_hour_paise),
        remainingHours: Math.max(0, Number(sub.purchased_hours) - Number(sub.consumed_hours)),
        isActive: sub.end_date >= new Date().toISOString().slice(0, 10),
      };
    }
  }

  const hourlyRatePaise = Number(
    (match.grounds as unknown as { hourly_rate_paise: number } | null)?.hourly_rate_paise ?? 0,
  );

  // Run the (unit-tested) engine.
  const result = settleMatch({
    matchId,
    durationMinutes: Number(match.duration_mins),
    attendance,
    subscription,
    ground: { hourlyRatePaise },
    model: match.cost_model,
  });

  // Translate engine postings into signed wallet deltas.
  const postings = result.postings.map((p) => ({
    user_id: p.userId,
    type: p.type,
    amount_paise: p.type === 'usage' ? -p.amountPaise : p.amountPaise,
    note: p.type === 'usage' ? 'Match usage' : 'Investor return',
  }));

  const { error } = await supabase.rpc('settle_match', {
    p_match_id: matchId,
    p_total_cost: result.totalCostPaise,
    p_subscription_id: subscription?.id ?? null,
    p_hours_from_sub: result.deduction.hoursFromSubscription,
    p_postings: postings,
  });
  if (error) return { error: error.message };

  await supabase.rpc('log_audit', {
    p_group: match.group_id,
    p_action: 'settle_match',
    p_entity: 'match',
    p_entity_id: matchId,
    p_after: { total_cost_paise: result.totalCostPaise, model: match.cost_model },
  });

  // Notify present players that their share is ready (PRD §17).
  await Promise.all(
    attendance.map((a) =>
      supabase.rpc('create_notification', {
        p_user: a.userId,
        p_group: match.group_id,
        p_type: 'settlement',
        p_title: 'Match settled',
        p_body: 'Your share for the match has been calculated.',
      }),
    ),
  );

  revalidatePath(`/matches/${matchId}`);
  revalidatePath('/dashboard');
  revalidatePath('/wallet');
  return {};
}
