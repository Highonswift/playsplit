import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin, CalendarDays, Coins } from 'lucide-react';
import { getActiveGroup } from '@/lib/groups';
import { getCricketMatch, FORMAT_LABELS } from '@/lib/cricket';
import { TossForm } from '@/components/cricket-forms';
import { Badge } from '@/components/ui';

export default async function CricketMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const m = await getCricketMatch(id);
  if (!m) notFound();
  const isAdmin = group.role !== 'player';

  const tossDone = !!m.toss_winner_team_id;
  const tossWinner = m.toss_winner_team_id === m.team_a.id ? m.team_a : m.team_b;
  const battingFirst = m.batting_first_team_id === m.team_a.id ? m.team_a : m.team_b;

  return (
    <div className="space-y-5">
      <Link href="/cricket" className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft size={16} /> Cricket
      </Link>

      {/* Match header */}
      <div className="card">
        <div className="flex items-center justify-between">
          {[m.team_a, m.team_b].map((t, i) => (
            <div key={t.id} className={`flex flex-1 flex-col items-center gap-1.5 ${i === 0 ? '' : 'order-2'}`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: t.color }}>
                {(t.short_name ?? t.name).slice(0, 3).toUpperCase()}
              </span>
              <span className="text-center text-sm font-semibold">{t.name}</span>
            </div>
          ))}
          <span className="order-1 px-3 font-display text-sm font-bold text-muted">vs</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Badge tone="neutral">{FORMAT_LABELS[m.format]}{m.overs ? ` · ${m.overs} ov` : ''}</Badge>
          <Badge tone="neutral">{m.players_per_side}-a-side</Badge>
          <Badge tone="info" className="capitalize">{m.status.replace('_', ' ')}</Badge>
        </div>
        <div className="mt-3 flex flex-col items-center gap-1 text-sm text-muted">
          <span className="flex items-center gap-1.5"><CalendarDays size={13} /> {m.match_date}{m.start_time ? ` · ${m.start_time}` : ''}</span>
          {m.venue && <span className="flex items-center gap-1.5"><MapPin size={13} /> {m.venue}</span>}
        </div>
      </div>

      {/* Toss */}
      <div className="card">
        <div className="mb-2 flex items-center gap-2">
          <Coins size={16} className="text-muted" />
          <h2 className="font-semibold">Toss</h2>
        </div>
        {tossDone ? (
          <p className="text-sm">
            <span className="font-semibold">{tossWinner.name}</span> won the toss and elected to{' '}
            <span className="font-semibold">{m.toss_decision === 'bat' ? 'bat' : 'bowl'}</span> first.
            {' '}<span className="font-semibold">{battingFirst.name}</span> bats first.
          </p>
        ) : isAdmin ? (
          <TossForm matchId={m.id} teamA={m.team_a} teamB={m.team_b} />
        ) : (
          <p className="text-sm text-muted">Toss not recorded yet.</p>
        )}
      </div>

      {/* Scoring placeholder (Phase 3) */}
      <div className="card border-dashed text-center text-sm text-muted">
        Live ball-by-ball scoring & scorecard arrive in Phase 3.
      </div>
    </div>
  );
}
