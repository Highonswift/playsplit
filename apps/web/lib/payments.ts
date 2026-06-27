import { createClient } from '@/lib/supabase/server';

export interface MemberBalance {
  user_id: string;
  full_name: string | null;
  balance_paise: number; // negative = owes
}

export interface PaymentRow {
  id: string;
  user_id: string;
  full_name: string | null;
  amount_paise: number;
  method: string;
  status: string;
  created_at: string;
}

/** All members' wallet balances in a group (admin collections view). */
export async function getGroupBalances(groupId: string): Promise<MemberBalance[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('wallet_accounts')
    .select('user_id, cached_balance_paise, profiles(full_name)')
    .eq('group_id', groupId);
  return (data ?? [])
    .map((w) => ({
      user_id: w.user_id,
      balance_paise: Number(w.cached_balance_paise),
      full_name: (w.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
    }))
    .sort((a, b) => a.balance_paise - b.balance_paise);
}

/** Total outstanding (sum of amounts owed) across a group, in paise. */
export async function getGroupOutstanding(groupId: string): Promise<number> {
  const balances = await getGroupBalances(groupId);
  return balances.filter((b) => b.balance_paise < 0).reduce((a, b) => a - b.balance_paise, 0);
}

export async function getPayments(groupId: string): Promise<PaymentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payments')
    .select('id, user_id, amount_paise, method, status, created_at, profiles(full_name)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map((p) => ({
    id: p.id,
    user_id: p.user_id,
    amount_paise: Number(p.amount_paise),
    method: p.method as string,
    status: p.status as string,
    created_at: p.created_at,
    full_name: (p.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }));
}
