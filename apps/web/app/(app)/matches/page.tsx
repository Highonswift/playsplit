import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { formatPaise } from '@playsplit/core';
import { getActiveGroup } from '@/lib/groups';
import { getMatches } from '@/lib/matches';
import { getGrounds, getSubscriptions } from '@/lib/subscriptions';
import { CreateMatchForm } from '@/components/match-forms';

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-amber-100 text-amber-700',
  settled: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-200 text-slate-500',
};

export default async function MatchesPage() {
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const [matches, grounds, subs] = await Promise.all([
    getMatches(group.id),
    getGrounds(group.id),
    getSubscriptions(group.id),
  ]);
  const isAdmin = group.role !== 'player';
  const liveSubs = subs.filter((s) => s.status !== 'expired' && s.status !== 'gray');

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Matches</h1>

      {isAdmin && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-brand-dark">+ Create a match</summary>
          <div className="mt-4">
            <CreateMatchForm
              grounds={grounds.map((g) => ({ id: g.id, name: g.name }))}
              subscriptions={liveSubs.map((s) => ({ id: s.id, name: s.name }))}
            />
          </div>
        </details>
      )}

      {matches.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-10 text-center text-[var(--muted)]">
          <CalendarDays size={28} />
          <p className="text-sm">No matches yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => (
            <li key={m.id}>
              <Link href={`/matches/${m.id}`} className="card flex items-center justify-between">
                <div>
                  <p className="font-semibold">{m.ground_name}</p>
                  <p className="stat-label">
                    {m.match_date} · {m.start_time}–{m.end_time}
                    {m.status === 'settled' && ` · ${formatPaise(m.total_cost_paise)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[m.status]}`}
                  >
                    {m.status}
                  </span>
                  <ChevronRight size={18} className="text-[var(--muted)]" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
