import { Sidebar, BottomNav } from '@/components/nav';

/** Authenticated app shell: sidebar on desktop, bottom-nav on mobile (PRD §24). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 pb-20 md:pb-0">
        <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
