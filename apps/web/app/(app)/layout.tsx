import { Sidebar, BottomNav } from '@/components/nav';
import { MobileTopBar } from '@/components/account';
import { createClient } from '@/lib/supabase/server';

/** Authenticated app shell: sidebar on desktop, bottom-nav on mobile (PRD §24). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? '';

  return (
    <div className="flex min-h-screen">
      <Sidebar email={email} />
      <div className="flex-1 pb-20 md:pb-0">
        {email && <MobileTopBar email={email} />}
        <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
