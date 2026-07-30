import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, UsersRound, Link2 } from 'lucide-react';
import { getActiveGroup, getGroupMembers } from '@/lib/groups';
import { getPoolPlayers, getPoolPlayersWithLinks } from '@/lib/cricket';
import { PoolManager, AdminPlayerLink } from '@/components/pickup';

export default async function PoolPage() {
  const group = await getActiveGroup();
  if (!group) redirect('/groups');
  if (group.role === 'player') redirect('/cricket');

  const [pool, links, members] = await Promise.all([
    getPoolPlayers(group.id),
    getPoolPlayersWithLinks(group.id),
    getGroupMembers(group.id),
  ]);
  const memberRefs = members.map((m) => ({ user_id: m.user_id, full_name: m.full_name }));

  return (
    <div className="space-y-5">
      <Link href="/cricket" className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft size={16} /> Cricket
      </Link>

      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Player pool</h1>
        <p className="text-sm text-muted">
          Everyone who plays with {group.name}. Add all your regulars once — you&apos;ll pick who&apos;s
          here each day when you start a game.
        </p>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <UsersRound size={16} className="text-muted" />
          <h2 className="font-semibold">Players ({pool.length})</h2>
        </div>
        <PoolManager players={pool.map((p) => ({ id: p.id, full_name: p.full_name }))} />
      </div>

      {/* Link pool names to member accounts (members can also self-claim in Settings). */}
      {links.length > 0 && (
        <div className="card">
          <div className="mb-1 flex items-center gap-2">
            <Link2 size={16} className="text-muted" />
            <h2 className="font-semibold">Accounts</h2>
          </div>
          <p className="stat-label mb-3">
            Who&apos;s signed up. Members can claim their own name in Settings — fix any mismatch here.
          </p>
          <ul className="divide-y divide-border">
            {links.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm font-medium">{p.full_name}</span>
                <AdminPlayerLink playerId={p.id} currentUserId={p.user_id} members={memberRefs} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
