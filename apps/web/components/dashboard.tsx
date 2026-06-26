import { formatPaise } from '@playsplit/core';
import { CalendarDays, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import type { SubscriptionStatus } from '@playsplit/core';

export interface GroupDashboardData {
  groupName: string;
  sport: string;
  subscription: {
    name: string;
    status: SubscriptionStatus;
    remainingHours: number;
    daysRemaining: number;
    purchasedHours: number;
  } | null;
  upcomingMatches: { id: string; date: string; ground: string; rsvps: number }[];
  pendingPaymentsPaise: number;
  collectionRatePct: number;
  attendancePct: number;
  savingsPaise: number;
}

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  yellow: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  expired: 'bg-slate-200 text-slate-600',
  gray: 'bg-slate-100 text-slate-500',
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: 'default' | 'warn' | 'good';
}) {
  const toneClass =
    tone === 'warn' ? 'text-red-600' : tone === 'good' ? 'text-emerald-600' : '';
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        <Icon size={16} className="text-[var(--muted)]" />
      </div>
      <div className={`stat-value mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

export function GroupDashboard({ data }: { data: GroupDashboardData }) {
  const sub = data.subscription;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{data.groupName}</h1>
        <p className="text-sm capitalize text-[var(--muted)]">{data.sport} group</p>
      </div>

      {sub && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{sub.name}</p>
              <p className="stat-label mt-0.5">Active subscription</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[sub.status]}`}
            >
              {sub.status}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="stat-value">{sub.remainingHours}h</div>
              <div className="stat-label">Remaining hours</div>
            </div>
            <div>
              <div className="stat-value">{sub.daysRemaining}d</div>
              <div className="stat-label">Days remaining</div>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-brand"
              style={{
                width: `${Math.max(0, Math.min(100, (sub.remainingHours / sub.purchasedHours) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Pending payments"
          value={formatPaise(data.pendingPaymentsPaise)}
          icon={AlertCircle}
          tone={data.pendingPaymentsPaise > 0 ? 'warn' : 'good'}
        />
        <StatCard label="Collection rate" value={`${data.collectionRatePct}%`} icon={TrendingUp} />
        <StatCard label="Attendance" value={`${data.attendancePct}%`} icon={CalendarDays} />
        <StatCard
          label="Savings"
          value={formatPaise(data.savingsPaise)}
          icon={TrendingUp}
          tone="good"
        />
      </div>

      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <Clock size={16} className="text-[var(--muted)]" />
          <h2 className="font-semibold">Upcoming matches</h2>
        </div>
        {data.upcomingMatches.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No upcoming matches.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {data.upcomingMatches.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium">{m.ground}</p>
                  <p className="stat-label">{m.date}</p>
                </div>
                <span className="rounded-full bg-brand-light px-2.5 py-1 text-xs font-semibold text-brand-dark">
                  {m.rsvps} in
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
