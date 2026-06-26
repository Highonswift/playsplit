import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Settings2 } from 'lucide-react';
import { GroupDashboard, type GroupDashboardData } from '@/components/dashboard';
import { getActiveGroup, getGroupMembers } from '@/lib/groups';

export default async function DashboardPage() {
  const active = await getActiveGroup();

  // New users with no group land on onboarding.
  if (!active) redirect('/groups');

  const members = await getGroupMembers(active.id);

  // M1: real group identity; subscription/matches/aggregates fill in from M2–M5.
  const data: GroupDashboardData = {
    groupName: active.name,
    sport: active.sport,
    subscription: null,
    upcomingMatches: [],
    pendingPaymentsPaise: 0,
    collectionRatePct: 0,
    attendancePct: 0,
    savingsPaise: 0,
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
        <div className="card border-dashed text-center text-sm text-[var(--muted)]">
          No active subscription yet. Grounds & subscriptions arrive in milestone M2.
        </div>
      )}
    </div>
  );
}
