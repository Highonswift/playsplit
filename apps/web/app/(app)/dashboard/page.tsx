import { GroupDashboard, type GroupDashboardData } from '@/components/dashboard';
import { DEMO_DASHBOARD } from '@/lib/demo-data';
import { createClient } from '@/lib/supabase/server';

/**
 * Group dashboard (PRD §16). Reads the user's active group from Supabase.
 * Until group/match data exists for the user, falls back to seeded demo figures
 * so the shell is never empty during early development.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // TODO(M1): load the user's active group + live aggregates. Demo data for now.
  const data: GroupDashboardData = DEMO_DASHBOARD;

  return (
    <>
      {user?.email && (
        <p className="mb-3 text-xs text-[var(--muted)]">Signed in as {user.email}</p>
      )}
      <GroupDashboard data={data} />
    </>
  );
}
