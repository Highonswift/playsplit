import { Sidebar, BottomNav } from '@/components/nav';
import { MobileTopBar } from '@/components/account';
import { createClient } from '@/lib/supabase/server';
import { getUnreadCount } from '@/lib/notifications';

/** Authenticated app shell: sidebar on desktop, bottom-nav on mobile (PRD §24). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? '';
  const unread = user ? await getUnreadCount() : 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar email={email} unreadCount={unread} />
      <div className="flex-1 pb-20 md:pb-0">
        {email && <MobileTopBar email={email} unreadCount={unread} />}
        <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
