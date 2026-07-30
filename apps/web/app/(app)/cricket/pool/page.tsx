import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, UsersRound } from 'lucide-react';
import { getActiveGroup } from '@/lib/groups';
import { getPoolPlayers } from '@/lib/cricket';
import { PoolManager } from '@/components/pickup';

export default async function PoolPage() {
  const group = await getActiveGroup();
  if (!group) redirect('/groups');
  if (group.role === 'player') redirect('/cricket');

  const pool = await getPoolPlayers(group.id);

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
    </div>
  );
}
