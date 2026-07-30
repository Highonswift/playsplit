import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getActiveGroup } from '@/lib/groups';
import { getPoolPlayers } from '@/lib/cricket';
import { PickupSetup } from '@/components/pickup';

export default async function PickupPage() {
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
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Start a game</h1>
        <p className="text-sm text-muted">Pick who&apos;s here, split into two sides, and play.</p>
      </div>

      <PickupSetup pool={pool.map((p) => ({ id: p.id, full_name: p.full_name }))} />
    </div>
  );
}
