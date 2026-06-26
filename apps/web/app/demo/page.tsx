import { Sidebar, BottomNav } from '@/components/nav';
import { GroupDashboard } from '@/components/dashboard';
import { DEMO_DASHBOARD } from '@/lib/demo-data';

/**
 * Public, unauthenticated preview of the app shell + group dashboard using
 * seeded demo data. Lets the responsive UI be reviewed without a login session.
 */
export default function DemoPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 pb-20 md:pb-0">
        <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            Demo preview — seeded data, no sign-in required.
          </div>
          <GroupDashboard data={DEMO_DASHBOARD} />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
