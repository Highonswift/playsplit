import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Table2 } from 'lucide-react';
import { getActiveGroup } from '@/lib/groups';
import { getTeams } from '@/lib/cricket';
import { getTournament, getTournamentTeams, getTournamentTable } from '@/lib/tournaments';
import { RegisterTeamForm } from '@/components/tournament-forms';

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const tournament = await getTournament(id);
  if (!tournament) notFound();

  const [table, registered, allTeams] = await Promise.all([
    getTournamentTable(id),
    getTournamentTeams(id),
    getTeams(group.id),
  ]);
  const isAdmin = group.role !== 'player';
  const registeredIds = new Set(registered.map((t) => t.id));
  const unregistered = allTeams.filter((t) => !registeredIds.has(t.id)).map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-5">
      <Link href="/cricket/tournaments" className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft size={16} /> Tournaments
      </Link>
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{tournament.name}</h1>
        <p className="text-sm capitalize text-muted">{tournament.format.replace('_', ' ')} · {registered.length} teams</p>
      </div>

      {/* Points table */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <Table2 size={16} className="text-muted" />
          <h2 className="font-semibold">Points table</h2>
        </div>
        {registered.length === 0 ? (
          <p className="text-sm text-muted">Register teams to build the table.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted">
                <th className="py-1 font-medium">Team</th><th className="py-1 text-right font-medium">P</th><th className="py-1 text-right font-medium">W</th><th className="py-1 text-right font-medium">L</th><th className="py-1 text-right font-medium">T</th><th className="py-1 text-right font-medium">Pts</th><th className="py-1 text-right font-medium">NRR</th>
              </tr></thead>
              <tbody>
                {table.map((s, i) => (
                  <tr key={s.teamId} className="border-t border-divider">
                    <td className="py-1.5 font-medium"><span className="mr-2 text-muted">{i + 1}</span>{s.name}</td>
                    <td className="py-1.5 text-right tabular">{s.played}</td>
                    <td className="py-1.5 text-right tabular">{s.won}</td>
                    <td className="py-1.5 text-right tabular">{s.lost}</td>
                    <td className="py-1.5 text-right tabular">{s.tied}</td>
                    <td className="py-1.5 text-right font-bold tabular">{s.points}</td>
                    <td className="py-1.5 text-right tabular text-muted">{s.nrr > 0 ? '+' : ''}{s.nrr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register teams (admin) */}
      {isAdmin && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Teams</h2>
          {registered.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {registered.map((t) => (
                <li key={t.id} className="chip bg-surface-2 text-fg">{t.name}</li>
              ))}
            </ul>
          )}
          <RegisterTeamForm tournamentId={id} teams={unregistered} />
        </div>
      )}
    </div>
  );
}
