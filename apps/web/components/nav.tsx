'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Wallet, BarChart3, Settings } from 'lucide-react';

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/matches', label: 'Matches', icon: CalendarDays },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/** Desktop sidebar (hidden on mobile). */
export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--border)] bg-white p-4 md:block">
      <Link href="/dashboard" className="block px-2 text-xl font-extrabold text-brand">
        PlaySplit
      </Link>
      <nav className="mt-6 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? 'bg-brand-light text-brand-dark' : 'text-[var(--muted)] hover:bg-slate-50'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/** Mobile bottom navigation (hidden on desktop). */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[var(--border)] bg-white/95 backdrop-blur md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = path.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              active ? 'text-brand-dark' : 'text-[var(--muted)]'
            }`}
          >
            <item.icon size={22} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
