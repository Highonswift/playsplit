import { redirect } from 'next/navigation';
import { formatPaise } from '@playsplit/core';
import { getActiveGroup } from '@/lib/groups';
import { getMyWallet } from '@/lib/wallet';

const TYPE_LABELS: Record<string, string> = {
  usage: 'Match usage',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  investor_return: 'Investor return',
  settlement: 'Settlement',
};

export default async function WalletPage() {
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const wallet = await getMyWallet(group.id);
  const owes = wallet.balance_paise < 0;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Wallet</h1>

      <div className="card">
        <p className="stat-label">{group.name}</p>
        <p className={`mt-1 text-3xl font-extrabold ${owes ? 'text-red-600' : 'text-emerald-600'}`}>
          {formatPaise(Math.abs(wallet.balance_paise))}
        </p>
        <p className="text-sm text-[var(--muted)]">
          {owes ? 'Outstanding — you owe this amount' : 'Credit balance'}
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Transactions</h2>
        {wallet.transactions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {wallet.transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium">{TYPE_LABELS[t.type] ?? t.type}</p>
                  <p className="stat-label">{new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${t.amount_paise < 0 ? 'text-red-600' : 'text-emerald-600'}`}
                  >
                    {t.amount_paise < 0 ? '' : '+'}
                    {formatPaise(t.amount_paise)}
                  </p>
                  <p className="stat-label">bal {formatPaise(t.balance_after_paise)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
