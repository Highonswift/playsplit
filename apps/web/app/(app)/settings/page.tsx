import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MapPin, Users, ChevronRight, User, Coins } from 'lucide-react';
import { getActiveGroup } from '@/lib/groups';
import { createClient } from '@/lib/supabase/server';
import { ProfileForm, CostModelForm } from '@/components/settings-forms';

const LINKS = [
  { href: '/groups', label: 'Group & members', icon: Users, desc: 'Roster, roles, invite code' },
  { href: '/grounds', label: 'Grounds & subscriptions', icon: MapPin, desc: 'Venues, pricing, prepaid hours' },
];

export default async function SettingsPage() {
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .maybeSingle();

  const isAdmin = group.role !== 'player';

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>

      {/* Profile */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <User size={16} className="text-[var(--muted)]" />
          <h2 className="font-semibold">Your profile</h2>
        </div>
        <ProfileForm fullName={profile?.full_name ?? ''} />
      </div>

      {/* Cost model (admin) */}
      {isAdmin && (
        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <Coins size={16} className="text-[var(--muted)]" />
            <h2 className="font-semibold">Cost-sharing model</h2>
          </div>
          <CostModelForm current={group.cost_model} />
        </div>
      )}

      {/* Management links */}
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
        Reminder rules & payment-gateway config arrive in a later release.
      </p>
    </div>
  );
}
