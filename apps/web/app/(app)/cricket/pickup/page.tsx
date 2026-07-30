import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, UserCheck } from 'lucide-react';
import { getActiveGroup } from '@/lib/groups';
import { getPoolPlayers, getMyLinkedPlayer } from '@/lib/cricket';
import { getUser } from '@/lib/supabase/server';
import { PickupSetup } from '@/components/pickup';

export default async function PickupPage() {
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const user = await getUser();
  const isAdmin = group.role !== 'player';
  const myPlayer = user ? await getMyLinkedPlayer(group.id, user.id) : null;
  const canStart = isAdmin || !!myPlayer;

  return (
    <div className="space-y-5">
      <Link href="/cricket" className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft size={16} /> Cricket
      </Link>

      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Start a game</h1>
        <p className="text-sm text-muted">Pick who&apos;s here, split into two sides, and play.</p>
      </div>

      {canStart ? (
        <PickupSetup pool={(await getPoolPlayers(group.id)).map((p) => ({ id: p.id, full_name: p.full_name }))} />
      ) : (
        <div className="card text-center">
          <UserCheck size={22} className="mx-auto mb-2 text-muted" />
          <p className="text-sm font-medium">Claim your player first</p>
          <p className="mt-1 text-sm text-muted">
            Link your account to your name so you can start and score games.
          </p>
          <Link href="/settings" className="btn mt-3 inline-flex">Go to Settings</Link>
        </div>
      )}
    </div>
  );
}
