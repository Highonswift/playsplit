import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users, ChevronRight, Shield } from 'lucide-react';
import { getActiveGroup } from '@/lib/groups';
import { getTeams, getCricketMatches, FORMAT_LABELS } from '@/lib/cricket';
import { CreateTeamForm, CreateMatchForm } from '@/components/cricket-forms';
import { Badge, EmptyState, LivePill } from '@/components/ui';

const STATUS_TONE: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  scheduled: 'info', toss: 'warning', live: 'live', innings_break: 'warning',
  completed: 'success', abandoned: 'neutral', cancelled: 'neutral',
};

export default async function CricketPage() {
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const [teams, matches] = await Promise.all([getTeams(group.id), getCricketMatches(group.id)]);
  const isAdmin = group.role !== 'player';
  const teamRefs = teams.map((t) => ({ id: t.id, name: t.name, short_name: t.short_name, color: t.color }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Cricket</h1>
        <p className="text-sm text-muted">{group.name}</p>
      </div>

      {/* Matches */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <Shield size={16} className="text-muted" />
          <h2 className="font-semibold">Matches</h2>
        </div>
        {matches.length === 0 ? (
          <p className="text-sm text-muted">No cricket matches yet.</p>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => (
              <li key={m.id}>
                <Link href={`/cricket/matches/${m.id}`} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {m.team_a.short_name ?? m.team_a.name} vs {m.team_b.short_name ?? m.team_b.name}
                      </span>
                      {m.status === 'live' && <LivePill />}
                    </div>
                    <p className="stat-label mt-0.5">
                      {FORMAT_LABELS[m.format]}{m.overs ? ` · ${m.overs} ov` : ''} · {m.match_date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.status !== 'live' && (
                      <Badge tone={STATUS_TONE[m.status] ?? 'neutral'}>{m.status.replace('_', ' ')}</Badge>
                    )}
                    <ChevronRight size={18} className="text-muted" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-primary-dark">+ New match</summary>
            <div className="mt-3"><CreateMatchForm teams={teamRefs} /></div>
          </details>
        )}
      </div>

      {/* Teams */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <Users size={16} className="text-muted" />
          <h2 className="font-semibold">Teams</h2>
        </div>
        {teams.length === 0 ? (
          <p className="text-sm text-muted">No teams yet.</p>
        ) : (
          <ul className="space-y-2">
            {teams.map((t) => (
              <li key={t.id}>
                <Link href={`/cricket/teams/${t.id}`} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: t.color }}>
                      {(t.short_name ?? t.name).slice(0, 3).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="stat-label">{t.player_count} players{t.city ? ` · ${t.city}` : ''}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-primary-dark">+ New team</summary>
            <div className="mt-3"><CreateTeamForm /></div>
          </details>
        )}
      </div>

      {!isAdmin && teams.length === 0 && matches.length === 0 && (
        <EmptyState icon={Shield} title="No cricket yet" hint="A group admin can create teams and matches." />
      )}
    </div>
  );
}
