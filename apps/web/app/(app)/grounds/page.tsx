import { redirect } from 'next/navigation';
import { MapPin, Ticket } from 'lucide-react';
import { formatPaise, type SubscriptionStatus } from '@playsplit/core';
import { getActiveGroup } from '@/lib/groups';
import { getGrounds, getSubscriptions } from '@/lib/subscriptions';
import { CreateGroundForm, PurchaseSubscriptionForm } from '@/components/ground-forms';

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  yellow: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  expired: 'bg-slate-200 text-slate-600',
  gray: 'bg-slate-100 text-slate-500',
};

export default async function GroundsPage() {
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const [grounds, subs] = await Promise.all([getGrounds(group.id), getSubscriptions(group.id)]);
  const isAdmin = group.role !== 'player';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Grounds & subscriptions</h1>
        <p className="text-sm text-[var(--muted)]">{group.name}</p>
      </div>

      {/* Subscriptions */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <Ticket size={16} className="text-[var(--muted)]" />
          <h2 className="font-semibold">Subscriptions</h2>
        </div>
        {subs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No subscriptions yet.</p>
        ) : (
          <ul className="space-y-3">
            {subs.map((s) => (
              <li key={s.id} className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{s.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[s.status]}`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="stat-label mt-0.5">{s.ground_name} · {formatPaise(s.cost_paise)}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold">{s.remaining_hours}h</div>
                    <div className="stat-label">of {s.purchased_hours}h left</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{s.days_remaining}d</div>
                    <div className="stat-label">until {s.end_date}</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{formatPaise(s.rate_per_hour_paise)}</div>
                    <div className="stat-label">per hour</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-brand"
                    style={{
                      width: `${Math.max(0, Math.min(100, (s.remaining_hours / s.purchased_hours) * 100))}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-brand-dark">
              + Purchase a subscription
            </summary>
            <div className="mt-3">
              <PurchaseSubscriptionForm grounds={grounds} />
            </div>
          </details>
        )}
      </div>

      {/* Grounds */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <MapPin size={16} className="text-[var(--muted)]" />
          <h2 className="font-semibold">Grounds</h2>
        </div>
        {grounds.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No grounds yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {grounds.map((g) => (
              <li key={g.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium">{g.name}</p>
                  {g.address && <p className="stat-label">{g.address}</p>}
                </div>
                <span className="text-sm font-semibold">{formatPaise(g.hourly_rate_paise)}/h</span>
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-brand-dark">
              + Add a ground
            </summary>
            <div className="mt-3">
              <CreateGroundForm />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
