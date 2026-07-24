import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Medal, ChevronRight } from 'lucide-react';
import { getActiveGroup } from '@/lib/groups';
import { getTournaments } from '@/lib/tournaments';
import { CreateTournamentForm } from '@/components/tournament-forms';
import { Badge, EmptyState } from '@/components/ui';

export default async function TournamentsPage() {
  const group = await getActiveGroup();
  if (!group) redirect('/groups');
  const tournaments = await getTournaments(group.id);
  const isAdmin = group.role !== 'player';

  return (
    <div className="space-y-5">
      <Link href="/cricket" className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft size={16} /> Cricket
      </Link>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Tournaments</h1>

      {tournaments.length === 0 ? (
        <EmptyState icon={Medal} title="No tournaments yet" hint={isAdmin ? 'Create one below.' : 'A group admin can create tournaments.'} />
      ) : (
        <ul className="space-y-2">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link href={`/cricket/tournaments/${t.id}`} className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Medal size={20} className="text-primary" />
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="stat-label capitalize">{t.format.replace('_', ' ')} · {t.team_count} teams</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={t.status === 'active' ? 'success' : 'neutral'} className="capitalize">{t.status}</Badge>
                  <ChevronRight size={18} className="text-muted" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-primary-dark">+ New tournament</summary>
          <div className="mt-3"><CreateTournamentForm /></div>
        </details>
      )}
    </div>
  );
}
