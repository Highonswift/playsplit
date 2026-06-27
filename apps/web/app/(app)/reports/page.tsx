import { redirect } from 'next/navigation';
import { TrendingUp, CalendarCheck, Ticket, Wallet } from 'lucide-react';
import { formatPaise } from '@playsplit/core';
import { getActiveGroup } from '@/lib/groups';
import { getReports } from '@/lib/reports';

export default async function ReportsPage() {
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const r = await getReports(group.id);
  const totalBilled = r.collectedPaise + r.outstandingPaise;
  const collectionPct = totalBilled > 0 ? Math.round((r.collectedPaise / totalBilled) * 100) : 0;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>

      {/* Payment collection */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-[var(--muted)]" />
          <h2 className="font-semibold">Payment collection</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-emerald-600">{formatPaise(r.collectedPaise)}</div>
            <div className="stat-label">Collected</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-600">{formatPaise(r.outstandingPaise)}</div>
            <div className="stat-label">Outstanding</div>
          </div>
          <div>
            <div className="text-lg font-bold">{collectionPct}%</div>
            <div className="stat-label">Collection rate</div>
          </div>
        </div>
      </div>

      {/* Subscription utilization */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <Ticket size={16} className="text-[var(--muted)]" />
          <h2 className="font-semibold">Subscription utilization</h2>
        </div>
        {r.utilization.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No subscriptions.</p>
        ) : (
          <ul className="space-y-3">
            {r.utilization.map((u) => {
              const pct = u.purchased > 0 ? Math.round((u.consumed / u.purchased) * 100) : 0;
              return (
                <li key={u.name}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-[var(--muted)]">
                      {u.consumed}/{u.purchased}h ({pct}%)
                      {u.expired > 0 && ` · ${u.expired}h expired`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-brand" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Attendance report */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <CalendarCheck size={16} className="text-[var(--muted)]" />
          <h2 className="font-semibold">Attendance</h2>
        </div>
        {r.attendance.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No settled matches yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {r.attendance.map((a) => (
              <li key={a.name} className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">{a.name}</span>
                <span className="text-sm text-[var(--muted)]">{a.played} matches</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Wallet statement */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <Wallet size={16} className="text-[var(--muted)]" />
          <h2 className="font-semibold">Wallet statement</h2>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {r.balances.map((b) => (
            <li key={b.name} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">{b.name}</span>
              <span
                className={`text-sm font-semibold ${b.balance_paise < 0 ? 'text-red-600' : 'text-emerald-600'}`}
              >
                {b.balance_paise < 0
                  ? `owes ${formatPaise(-b.balance_paise)}`
                  : formatPaise(b.balance_paise)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
