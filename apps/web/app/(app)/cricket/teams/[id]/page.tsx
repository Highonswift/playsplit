import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Shirt } from 'lucide-react';
import { getActiveGroup } from '@/lib/groups';
import { getTeam, getTeamPlayers, ROLE_LABELS } from '@/lib/cricket';
import { AddPlayerForm } from '@/components/cricket-forms';
import { Badge } from '@/components/ui';

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const team = await getTeam(id);
  if (!team) notFound();
  const players = await getTeamPlayers(id);
  const isAdmin = group.role !== 'player';

  return (
    <div className="space-y-5">
      <Link href="/cricket" className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft size={16} /> Cricket
      </Link>

      <div className="card flex items-center gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ background: team.color }}
        >
          {(team.short_name ?? team.name).slice(0, 3).toUpperCase()}
        </span>
        <div>
          <h1 className="text-xl font-bold">{team.name}</h1>
          <p className="stat-label">{players.length} players{team.city ? ` · ${team.city}` : ''}</p>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <Shirt size={16} className="text-muted" />
          <h2 className="font-semibold">Squad</h2>
        </div>
        {players.length === 0 ? (
          <p className="text-sm text-muted">No players yet.</p>
        ) : (
          <ul className="divide-y divide-divider">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-7 text-center text-sm font-bold tabular text-muted">
                    {p.jersey_number ?? '–'}
                  </span>
                  <span className="text-sm font-medium">{p.full_name}</span>
                </div>
                <Badge tone="primary">{ROLE_LABELS[p.role]}</Badge>
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-primary-dark">+ Add player</summary>
            <div className="mt-3"><AddPlayerForm teamId={id} /></div>
          </details>
        )}
      </div>
    </div>
  );
}
