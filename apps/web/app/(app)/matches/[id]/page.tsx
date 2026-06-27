import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Clock, MapPin } from 'lucide-react';
import { formatPaise } from '@playsplit/core';
import { getActiveGroup } from '@/lib/groups';
import { getMatch, getMatchAttendance, getMatchCharges } from '@/lib/matches';
import { AttendanceEditor, SettleButton } from '@/components/match-forms';

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await getActiveGroup();
  if (!group) redirect('/groups');

  const match = await getMatch(id);
  if (!match) notFound();

  const [attendance, charges] = await Promise.all([
    getMatchAttendance(id),
    match.status === 'settled' ? getMatchCharges(id) : Promise.resolve([]),
  ]);

  const isAdmin = group.role !== 'player';
  const settled = match.status === 'settled';
  const presentCount = attendance.filter((a) => a.present).length;

  // Net per player from persisted postings (negative = owes, positive = credit).
  const byUser = new Map<string, { name: string | null; net: number }>();
  for (const c of charges) {
    const cur = byUser.get(c.user_id) ?? { name: c.full_name, net: 0 };
    cur.net += c.amount_paise;
    byUser.set(c.user_id, cur);
  }

  return (
    <div className="space-y-5">
      <Link href="/matches" className="inline-flex items-center gap-1 text-sm text-[var(--muted)]">
        <ArrowLeft size={16} /> Matches
      </Link>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{match.ground_name}</h1>
            <p className="mt-1 flex items-center gap-1.5 stat-label">
              <Clock size={13} /> {match.match_date} · {match.start_time}–{match.end_time} (
              {(match.duration_mins / 60).toFixed(1)}h)
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 stat-label capitalize">
              <MapPin size={13} /> {match.cost_model} cost-sharing
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize">
            {match.status}
          </span>
        </div>
        {settled && (
          <p className="mt-3 text-sm font-semibold">Total cost: {formatPaise(match.total_cost_paise)}</p>
        )}
      </div>

      {/* Attendance */}
      <div className="card">
        <h2 className="mb-2 font-semibold">Attendance ({presentCount} present)</h2>
        <AttendanceEditor
          matchId={match.id}
          rows={attendance}
          durationMins={match.duration_mins}
          editable={isAdmin && !settled}
        />
      </div>

      {/* Settle (admin, not yet settled) */}
      {isAdmin && !settled && (
        <div className="card">
          <h2 className="mb-1 font-semibold">Settle</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Runs the cost-sharing engine, deducts subscription hours, and posts each player&apos;s
            share to their wallet.
          </p>
          <SettleButton matchId={match.id} />
        </div>
      )}

      {/* Settlement result */}
      {settled && byUser.size > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Settlement</h2>
          <ul className="divide-y divide-[var(--border)]">
            {[...byUser.entries()].map(([uid, v]) => (
              <li key={uid} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium">{v.name ?? 'Unnamed player'}</span>
                <span
                  className={`text-sm font-semibold ${v.net < 0 ? 'text-red-600' : 'text-emerald-600'}`}
                >
                  {v.net < 0 ? `owes ${formatPaise(-v.net)}` : `credit ${formatPaise(v.net)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
