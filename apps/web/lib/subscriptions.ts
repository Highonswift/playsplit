import { deriveSubscriptionStatus, type SubscriptionStatus } from '@playsplit/core';
import { createClient } from '@/lib/supabase/server';

export interface Ground {
  id: string;
  name: string;
  address: string | null;
  contact_person: string | null;
  hourly_rate_paise: number;
}

export interface SubscriptionView {
  id: string;
  name: string;
  ground_id: string;
  ground_name: string;
  cost_paise: number;
  rate_per_hour_paise: number;
  purchased_hours: number;
  consumed_hours: number;
  remaining_hours: number;
  start_date: string;
  end_date: string;
  days_remaining: number;
  status: SubscriptionStatus;
}

/** Whole days from today (UTC) to an ISO date string; negative if past. */
function daysUntil(dateStr: string): number {
  const end = new Date(dateStr + 'T00:00:00Z').getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.round((end - today) / 86_400_000);
}

export async function getGrounds(groupId: string): Promise<Ground[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('grounds')
    .select('id, name, address, contact_person, hourly_rate_paise')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });
  return (data ?? []) as Ground[];
}

/** All subscriptions for a group with freshly-computed status + remaining. */
export async function getSubscriptions(groupId: string): Promise<SubscriptionView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('subscriptions')
    .select(
      'id, name, ground_id, cost_paise, rate_per_hour_paise, purchased_hours, consumed_hours, start_date, end_date, grounds(name)',
    )
    .eq('group_id', groupId)
    .order('end_date', { ascending: false });

  return (data ?? []).map((s) => {
    const purchased = Number(s.purchased_hours);
    const consumed = Number(s.consumed_hours);
    const daysRemaining = daysUntil(s.end_date);
    return {
      id: s.id,
      name: s.name,
      ground_id: s.ground_id,
      ground_name: (s.grounds as unknown as { name: string } | null)?.name ?? 'Ground',
      cost_paise: Number(s.cost_paise),
      rate_per_hour_paise: Number(s.rate_per_hour_paise),
      purchased_hours: purchased,
      consumed_hours: consumed,
      remaining_hours: Math.max(0, purchased - consumed),
      start_date: s.start_date,
      end_date: s.end_date,
      days_remaining: daysRemaining,
      status: deriveSubscriptionStatus({
        purchasedHours: purchased,
        consumedHours: consumed,
        daysRemaining,
        started: true,
      }),
    };
  });
}

/** The "current" active subscription for the dashboard: healthiest non-expired. */
export async function getActiveSubscription(groupId: string): Promise<SubscriptionView | null> {
  const subs = await getSubscriptions(groupId);
  const live = subs.filter((s) => s.status !== 'expired' && s.status !== 'gray');
  if (live.length === 0) return null;
  // Prefer the one with the most remaining hours.
  return live.sort((a, b) => b.remaining_hours - a.remaining_hours)[0]!;
}
