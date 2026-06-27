import { subscriptionSavings } from '@playsplit/core';
import { createClient } from '@/lib/supabase/server';
import { getGroupBalances, getGroupOutstanding } from '@/lib/payments';

export interface DashboardStats {
  pendingPaymentsPaise: number;
  collectionRatePct: number;
  attendancePct: number;
  savingsPaise: number;
  upcomingMatches: { id: string; date: string; ground: string; rsvps: number }[];
}

/** Aggregates for the group dashboard (PRD §16), all from live data. */
export async function getDashboardStats(groupId: string): Promise<DashboardStats> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: payments }, { data: usage }, { data: subs }, { data: upcoming }, { data: matches }] =
    await Promise.all([
      supabase.from('payments').select('amount_paise').eq('group_id', groupId).eq('status', 'paid'),
      supabase
        .from('wallet_transactions')
        .select('amount_paise, wallet_accounts!inner(group_id)')
        .eq('type', 'usage')
        .eq('wallet_accounts.group_id', groupId),
      supabase
        .from('subscriptions')
        .select('consumed_hours, rate_per_hour_paise, ground_id, grounds(hourly_rate_paise)')
        .eq('group_id', groupId),
      supabase
        .from('matches')
        .select('id, match_date, start_time, grounds(name)')
        .eq('group_id', groupId)
        .gte('match_date', today)
        .order('match_date', { ascending: true })
        .limit(5),
      supabase.from('matches').select('id, status').eq('group_id', groupId),
    ]);

  const collected = (payments ?? []).reduce((a, p) => a + Number(p.amount_paise), 0);
  const billed = (usage ?? []).reduce((a, u) => a - Number(u.amount_paise), 0); // usage is negative
  const collectionRatePct = billed > 0 ? Math.round((collected / billed) * 100) : 0;

  // Savings = (hourly - sub rate) * consumed hours, summed across subscriptions.
  const savingsPaise = (subs ?? []).reduce((acc, s) => {
    const hourly = Number((s.grounds as unknown as { hourly_rate_paise: number } | null)?.hourly_rate_paise ?? 0);
    return acc + subscriptionSavings(Number(s.consumed_hours), Number(s.rate_per_hour_paise), hourly);
  }, 0);

  // Attendance %: present rows / total attendance rows across settled+completed matches.
  const settledIds = (matches ?? []).filter((m) => m.status === 'settled').map((m) => m.id);
  let attendancePct = 0;
  if (settledIds.length > 0) {
    const { data: att } = await supabase
      .from('match_attendance')
      .select('present, match_id')
      .in('match_id', settledIds);
    const total = (att ?? []).length;
    const present = (att ?? []).filter((a) => a.present).length;
    attendancePct = total > 0 ? Math.round((present / total) * 100) : 0;
  }

  return {
    pendingPaymentsPaise: await getGroupOutstanding(groupId),
    collectionRatePct,
    attendancePct,
    savingsPaise,
    upcomingMatches: (upcoming ?? []).map((m) => ({
      id: m.id,
      date: `${m.match_date} · ${(m.start_time as string)?.slice(0, 5)}`,
      ground: (m.grounds as unknown as { name: string } | null)?.name ?? 'Ground',
      rsvps: 0,
    })),
  };
}

export interface ReportData {
  collectedPaise: number;
  outstandingPaise: number;
  attendance: { name: string; played: number }[];
  utilization: { name: string; consumed: number; purchased: number; expired: number }[];
  balances: { name: string; balance_paise: number }[];
}

/** Reports & analytics (PRD §18–19) computed from the ledger. */
export async function getReports(groupId: string): Promise<ReportData> {
  const supabase = await createClient();

  const [{ data: payments }, { data: subs }, balances] = await Promise.all([
    supabase.from('payments').select('amount_paise').eq('group_id', groupId).eq('status', 'paid'),
    supabase
      .from('subscriptions')
      .select('name, consumed_hours, purchased_hours, expired_hours')
      .eq('group_id', groupId),
    getGroupBalances(groupId),
  ]);

  // Attendance per player across settled matches.
  const { data: matchRows } = await supabase
    .from('matches')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'settled');
  const matchIds = (matchRows ?? []).map((m) => m.id);
  const attendanceMap = new Map<string, { name: string; played: number }>();
  if (matchIds.length > 0) {
    const { data: att } = await supabase
      .from('match_attendance')
      .select('user_id, present, profiles(full_name)')
      .in('match_id', matchIds)
      .eq('present', true);
    for (const a of att ?? []) {
      const name = (a.profiles as unknown as { full_name: string | null } | null)?.full_name ?? 'Unnamed';
      const cur = attendanceMap.get(a.user_id) ?? { name, played: 0 };
      cur.played += 1;
      attendanceMap.set(a.user_id, cur);
    }
  }

  return {
    collectedPaise: (payments ?? []).reduce((a, p) => a + Number(p.amount_paise), 0),
    outstandingPaise: balances.filter((b) => b.balance_paise < 0).reduce((a, b) => a - b.balance_paise, 0),
    attendance: [...attendanceMap.values()].sort((a, b) => b.played - a.played),
    utilization: (subs ?? []).map((s) => ({
      name: s.name,
      consumed: Number(s.consumed_hours),
      purchased: Number(s.purchased_hours),
      expired: Number(s.expired_hours),
    })),
    balances: balances.map((b) => ({ name: b.full_name ?? 'Unnamed', balance_paise: b.balance_paise })),
  };
}
