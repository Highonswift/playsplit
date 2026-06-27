'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/** Bell icon linking to notifications, with an unread count badge. */
export function NotificationBell({ count }: { count: number }) {
  return (
    <Link
      href="/notifications"
      aria-label="Notifications"
      className="relative rounded-xl p-2 text-[var(--muted)] transition hover:bg-slate-100"
    >
      <Bell size={20} />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}

/** Signs the user out and returns them to the login screen. */
export function SignOutButton({
  variant = 'full',
}: {
  variant?: 'full' | 'icon';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={signOut}
        disabled={loading}
        aria-label="Sign out"
        className="rounded-xl p-2 text-[var(--muted)] transition hover:bg-slate-100 active:scale-95"
      >
        <LogOut size={20} />
      </button>
    );
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:bg-slate-50 disabled:opacity-50"
    >
      <LogOut size={20} />
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

/** Initials avatar from an email/name. */
function Avatar({ label }: { label: string }) {
  const initials = label.slice(0, 2).toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-bold text-brand-dark">
      {initials}
    </div>
  );
}

/** Desktop sidebar footer: identity + sign out. */
export function AccountFooter({ email }: { email: string }) {
  return (
    <div className="mt-auto border-t border-[var(--border)] pt-3">
      <div className="flex items-center gap-2 px-1 pb-2">
        <Avatar label={email} />
        <span className="truncate text-xs text-[var(--muted)]">{email}</span>
      </div>
      <SignOutButton />
    </div>
  );
}

/** Mobile top bar: identity + notifications + sign-out (the bottom nav is full). */
export function MobileTopBar({ email, unreadCount = 0 }: { email: string; unreadCount?: number }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-white/95 px-4 py-2.5 backdrop-blur md:hidden">
      <div className="flex items-center gap-2">
        <Avatar label={email} />
        <span className="text-sm font-semibold text-brand">PlaySplit</span>
      </div>
      <div className="flex items-center gap-1">
        <NotificationBell count={unreadCount} />
        <SignOutButton variant="icon" />
      </div>
    </header>
  );
}
