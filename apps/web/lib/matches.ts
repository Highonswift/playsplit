import { createClient } from '@/lib/supabase/server';
import type { CostModel } from '@playsplit/core';

export interface MatchView {
  id: string;
  match_date: string;
  start_time: string;
  end_time: string;
  duration_mins: number;
  ground_id: string;
  ground_name: string;
  subscription_id: string | null;
  cost_model: CostModel;
  status: 'scheduled' | 'completed' | 'settled' | 'cancelled';
  payment_status: string;
  total_cost_paise: number;
}

export interface AttendanceRow {
  user_id: string;
  full_name: string | null;
  rsvp: boolean | null;
  present: boolean;
  is_investor: boolean;
  billable_minutes: number;
}

export interface MatchCharge {
  user_id: string;
  full_name: string | null;
  type: string;
  amount_paise: number;
  balance_after_paise: number;
}

function mapMatch(m: Record<string, unknown>): MatchView {
  return {
    id: m.id as string,
    match_date: m.match_date as string,
    start_time: (m.start_time as string)?.slice(0, 5),
    end_time: (m.end_time as string)?.slice(0, 5),
    duration_mins: Number(m.duration_mins),
    ground_id: m.ground_id as string,
    ground_name: (m.grounds as { name: string } | null)?.name ?? 'Ground',
    subscription_id: (m.subscription_id as string) ?? null,
    cost_model: m.cost_model as CostModel,
    status: m.status as MatchView['status'],
    payment_status: m.payment_status as string,
    total_cost_paise: Number(m.total_cost_paise),
  };
}

const MATCH_COLS =
  'id, match_date, start_time, end_time, duration_mins, ground_id, subscription_id, cost_model, status, payment_status, total_cost_paise, grounds(name)';

export async function getMatches(groupId: string): Promise<MatchView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('matches')
    .select(MATCH_COLS)
    .eq('group_id', groupId)
    .order('match_date', { ascending: false });
  return (data ?? []).map((m) => mapMatch(m as Record<string, unknown>));
}

export async function getMatch(matchId: string): Promise<MatchView | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('matches').select(MATCH_COLS).eq('id', matchId).maybeSingle();
  return data ? mapMatch(data as Record<string, unknown>) : null;
}

export async function getMatchAttendance(matchId: string): Promise<AttendanceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('match_attendance')
    .select('user_id, rsvp, present, is_investor, billable_minutes, profiles(full_name)')
    .eq('match_id', matchId);
  return (data ?? []).map((r) => ({
    user_id: r.user_id,
    rsvp: r.rsvp,
    present: r.present,
    is_investor: r.is_investor,
    billable_minutes: Number(r.billable_minutes),
    full_name: (r.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }));
}

/** The persisted settlement result for a match (wallet postings + names). */
export async function getMatchCharges(matchId: string): Promise<MatchCharge[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('wallet_transactions')
    .select('type, amount_paise, balance_after_paise, wallet_accounts(user_id, profiles(full_name))')
    .eq('match_id', matchId);
  return (data ?? []).map((r) => {
    const wa = r.wallet_accounts as unknown as {
      user_id: string;
      profiles: { full_name: string | null } | null;
    } | null;
    return {
      user_id: wa?.user_id ?? '',
      full_name: wa?.profiles?.full_name ?? null,
      type: r.type as string,
      amount_paise: Number(r.amount_paise),
      balance_after_paise: Number(r.balance_after_paise),
    };
  });
}
