import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MapPin, Users, ChevronRight, User, Coins, UserCheck } from 'lucide-react';
import { getActiveGroup } from '@/lib/groups';
import { getPoolPlayersWithLinks } from '@/lib/cricket';
import { createClient, getUser } from '@/lib/supabase/server';
import { ProfileForm, CostModelForm } from '@/components/settings-forms';
import { ClaimPlayerCard } from '@/components/pickup';

const LINKS = [
  { href: '/groups', label: 'Group & members', icon: Users, desc: 'Roster, roles, invite code' },
  { href: '/grounds', label: 'Grounds & subscriptions', icon: MapPin, desc: 'Venues, pricing, prepaid hours' },
];

export default async function SettingsPage() {
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .maybeSingle();

  const isAdmin = group.role !== 'player';

  // "Which player are you?" — link this account to a pool name (pickup groups).
  const poolLinks = await getPoolPlayersWithLinks(group.id);
  const myPlayer = poolLinks.find((p) => p.user_id === user!.id) ?? null;
  const unclaimed = poolLinks.filter((p) => !p.user_id);

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

      {/* Your cricket player (pickup pool) */}
      {poolLinks.length > 0 && (
        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <UserCheck size={16} className="text-[var(--muted)]" />
            <h2 className="font-semibold">Your cricket player</h2>
          </div>
          <ClaimPlayerCard
            linked={myPlayer ? { id: myPlayer.id, full_name: myPlayer.full_name } : null}
            options={unclaimed.map((p) => ({ id: p.id, full_name: p.full_name }))}
          />
        </div>
      )}

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
