import Link from 'next/link';
import { MapPin, Users, ChevronRight } from 'lucide-react';

const LINKS = [
  { href: '/groups', label: 'Group & members', icon: Users, desc: 'Roster, roles, invite code' },
  { href: '/grounds', label: 'Grounds & subscriptions', icon: MapPin, desc: 'Venues, pricing, prepaid hours' },
];

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
      <div className="card divide-y divide-[var(--border)] p-0">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-3.5">
            <div className="rounded-xl bg-brand-light p-2 text-brand-dark">
              <l.icon size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{l.label}</p>
              <p className="stat-label">{l.desc}</p>
            </div>
            <ChevronRight size={18} className="text-[var(--muted)]" />
          </Link>
        ))}
      </div>
      <p className="px-1 text-xs text-[var(--muted)]">
        Reminder rules, payment gateway & cost-model settings arrive in milestone M7.
      </p>
    </div>
  );
}
