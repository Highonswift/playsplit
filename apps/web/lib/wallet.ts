import { createClient } from '@/lib/supabase/server';

export interface WalletTxn {
  id: string;
  type: string;
  amount_paise: number;
  balance_after_paise: number;
  note: string | null;
  created_at: string;
}

export interface WalletView {
  balance_paise: number;
  transactions: WalletTxn[];
}

/** The signed-in user's wallet for a group (balance + transaction history). */
export async function getMyWallet(groupId: string): Promise<WalletView> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { balance_paise: 0, transactions: [] };

  const { data: account } = await supabase
    .from('wallet_accounts')
    .select('id, cached_balance_paise')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!account) return { balance_paise: 0, transactions: [] };

  const { data: txns } = await supabase
    .from('wallet_transactions')
    .select('id, type, amount_paise, balance_after_paise, note, created_at')
    .eq('account_id', account.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return {
    balance_paise: Number(account.cached_balance_paise),
    transactions: (txns ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      amount_paise: Number(t.amount_paise),
      balance_after_paise: Number(t.balance_after_paise),
      note: t.note,
      created_at: t.created_at,
    })),
  };
}
