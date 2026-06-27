import { redirect } from 'next/navigation';
import { formatPaise } from '@playsplit/core';
import { getActiveGroup } from '@/lib/groups';
import { getMyWallet } from '@/lib/wallet';
import { getGroupBalances, getPayments } from '@/lib/payments';
import { RecordPaymentForm, PayButton } from '@/components/payment-forms';

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

  const isAdmin = group.role !== 'player';
  const [wallet, balances, payments] = await Promise.all([
    getMyWallet(group.id),
    isAdmin ? getGroupBalances(group.id) : Promise.resolve([]),
    isAdmin ? getPayments(group.id) : Promise.resolve([]),
  ]);
  const owes = wallet.balance_paise < 0;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Wallet</h1>

      {/* My balance */}
      <div className="card">
        <p className="stat-label">{group.name}</p>
        <p className={`mt-1 text-3xl font-extrabold ${owes ? 'text-red-600' : 'text-emerald-600'}`}>
          {formatPaise(Math.abs(wallet.balance_paise))}
        </p>
        <p className="text-sm text-[var(--muted)]">
          {owes ? 'Outstanding — you owe this amount' : 'Credit balance'}
        </p>
        {owes && (
          <div className="mt-3">
            <PayButton amountPaise={-wallet.balance_paise} />
          </div>
        )}
      </div>

      {/* Admin: collections */}
      {isAdmin && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Collections</h2>
          {balances.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No members yet.</p>
          ) : (
            <ul className="mb-4 divide-y divide-[var(--border)]">
              {balances.map((b) => (
                <li key={b.user_id} className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">{b.full_name ?? 'Unnamed'}</span>
                  <span
                    className={`text-sm font-semibold ${
                      b.balance_paise < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {b.balance_paise < 0
                      ? `owes ${formatPaise(-b.balance_paise)}`
                      : formatPaise(b.balance_paise)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-brand-dark">
              + Record a payment
            </summary>
            <div className="mt-3">
              <RecordPaymentForm members={balances} />
            </div>
          </details>
        </div>
      )}

      {/* My transactions */}
      <div className="card">
        <h2 className="mb-3 font-semibold">My transactions</h2>
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
                    className={`text-sm font-semibold ${
                      t.amount_paise < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
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

      {/* Admin: recent payments */}
      {isAdmin && payments.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Recent payments</h2>
          <ul className="divide-y divide-[var(--border)]">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium">{p.full_name ?? 'Unnamed'}</p>
                  <p className="stat-label capitalize">
                    {p.method.replace('_', ' ')} · {new Date(p.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-600">
                  +{formatPaise(p.amount_paise)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
