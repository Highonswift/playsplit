import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Settings2 } from 'lucide-react';
import { GroupDashboard, type GroupDashboardData } from '@/components/dashboard';
import { getActiveGroup, getGroupMembers } from '@/lib/groups';
import { getActiveSubscription } from '@/lib/subscriptions';
import { getDashboardStats } from '@/lib/reports';

export default async function DashboardPage() {
  const active = await getActiveGroup();

  // New users with no group land on onboarding.
  if (!active) redirect('/groups');

  const [members, sub, stats] = await Promise.all([
    getGroupMembers(active.id),
    getActiveSubscription(active.id),
    getDashboardStats(active.id),
  ]);

  const data: GroupDashboardData = {
    groupName: active.name,
    sport: active.sport,
    subscription: sub
      ? {
          name: sub.name,
          status: sub.status,
          remainingHours: sub.remaining_hours,
          daysRemaining: sub.days_remaining,
          purchasedHours: sub.purchased_hours,
        }
      : null,
    upcomingMatches: stats.upcomingMatches,
    pendingPaymentsPaise: stats.pendingPaymentsPaise,
    collectionRatePct: stats.collectionRatePct,
    attendancePct: stats.attendancePct,
    savingsPaise: stats.savingsPaise,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          {members.length} member{members.length === 1 ? '' : 's'} · {active.role.replace('_', ' ')}
        </p>
        <Link
          href="/groups"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-dark"
        >
          <Settings2 size={14} /> Manage group
        </Link>
      </div>
      <GroupDashboard data={data} />
      {!data.subscription && (
        <Link
          href="/grounds"
          className="card block border-dashed text-center text-sm font-medium text-brand-dark"
        >
          + Add a ground & purchase a subscription
        </Link>
      )}
    </div>
  );
}
