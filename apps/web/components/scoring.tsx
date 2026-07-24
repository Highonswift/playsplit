'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { InningsState } from '@playsplit/cricket';
import {
  startInningsAction,
  recordDeliveryAction,
  undoAction,
  endInningsAction,
  type Result,
  type DeliveryPayload,
} from '@/app/(app)/cricket/matches/[id]/scoring-actions';
import { Badge, LivePill } from '@/components/ui';

type PlayerRef = { id: string; full_name: string; role: string };
const INITIAL: Result = {};

const DISMISSALS = [
  'bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket',
  'retired_out', 'retired_hurt', 'obstructing', 'hit_twice', 'timed_out',
];

function oversFromBalls(b: number) {
  return `${Math.floor(b / 6)}.${b % 6}`;
}

const BALL_STYLE: Record<string, string> = {
  W: 'bg-danger text-white',
  '4': 'bg-info/15 text-info',
  '6': 'bg-primary text-primary-contrast',
};
function ballTone(sym: string) {
  if (sym.includes('W')) return BALL_STYLE.W;
  if (sym === '4') return BALL_STYLE['4'];
  if (sym === '6') return BALL_STYLE['6'];
  if (/wd|nb|^b|^lb/.test(sym)) return 'bg-warning/15 text-warning';
  return 'bg-surface-2 text-muted';
}

/* ---------------- Start innings ---------------- */
export function StartInningsForm({
  matchId, number, battingTeamId, bowlingTeamId, battingPlayers, target,
}: {
  matchId: string; number: number; battingTeamId: string; bowlingTeamId: string;
  battingPlayers: PlayerRef[]; target?: number | null;
}) {
  const [state, action, pending] = useActionState(startInningsAction, INITIAL);
  if (battingPlayers.length < 2) {
    return <p className="text-sm text-muted">The batting team needs at least 2 players to start.</p>;
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="batting_team_id" value={battingTeamId} />
      <input type="hidden" name="bowling_team_id" value={bowlingTeamId} />
      {target != null && <input type="hidden" name="target" value={target} />}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Striker</label>
          <select className="input" name="striker_id" defaultValue={battingPlayers[0]!.id}>
            {battingPlayers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Non-striker</label>
          <select className="input" name="non_striker_id" defaultValue={battingPlayers[1]!.id}>
            {battingPlayers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? 'Starting…' : 'Start innings'}</button>
    </form>
  );
}

/* ---------------- Live scoreboard ---------------- */
export function LiveScoreboard({
  state, names, battingTeamName, requiredRunRate, ballsRemaining, target, winProb,
}: {
  state: InningsState; names: Record<string, string>; battingTeamName: string;
  requiredRunRate: number | null; ballsRemaining: number | null; target: number | null;
  winProb?: number | null;
}) {
  const striker = state.batting.find((b) => b.playerId === state.strikerId);
  const nonStriker = state.batting.find((b) => b.playerId === state.nonStrikerId);
  const bowler = state.bowling.find((b) => b.playerId === state.bowlerId);
  const nm = (id?: string | null) => (id ? names[id] ?? 'Player' : '—');

  return (
    <div className="card space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="stat-label">{battingTeamName}</p>
          <p className="font-display text-4xl font-extrabold tabular">
            {state.totalRuns}<span className="text-2xl">/{state.wickets}</span>
          </p>
          <p className="stat-label">({state.oversText}{state.maxOvers ? ` / ${state.maxOvers}` : ''} ov)</p>
        </div>
        <div className="text-right">
          <LivePill />
          <p className="mt-2 stat-label">CRR <span className="font-bold text-fg tabular">{state.runRate}</span></p>
          {requiredRunRate != null && ballsRemaining != null && (
            <p className="stat-label">RRR <span className="font-bold text-fg tabular">{requiredRunRate}</span></p>
          )}
        </div>
      </div>

      {target != null && ballsRemaining != null && (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-center text-sm font-medium">
          Need <b className="tabular">{Math.max(0, target - state.totalRuns)}</b> off{' '}
          <b className="tabular">{ballsRemaining}</b> balls
        </p>
      )}

      {winProb != null && (
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold">{battingTeamName} <span className="tabular">{winProb}%</span></span>
            <span className="text-muted">win probability</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-primary" style={{ width: `${winProb}%` }} />
            <div className="h-full bg-danger/60" style={{ width: `${100 - winProb}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="font-semibold">{nm(state.strikerId)} <span className="text-primary">*</span></p>
          <p className="stat-label tabular">{striker?.runs ?? 0} ({striker?.balls ?? 0})</p>
        </div>
        <div>
          <p className="font-semibold">{nm(state.nonStrikerId)}</p>
          <p className="stat-label tabular">{nonStriker?.runs ?? 0} ({nonStriker?.balls ?? 0})</p>
        </div>
      </div>

      <div className="border-t border-divider pt-2 text-sm">
        <p className="font-semibold">{nm(state.bowlerId)}</p>
        <p className="stat-label tabular">
          {bowler ? `${oversFromBalls(bowler.legalBalls)}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : '0.0-0-0-0'}
        </p>
      </div>

      {state.currentOver.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="stat-label mr-1">This over</span>
          {state.currentOver.map((s, i) => (
            <span key={i} className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold ${ballTone(s)}`}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Umpire scoring pad ---------------- */
export function ScoringPad({
  matchId, inningsId, state, bowlingPlayers, battingPlayers, names, deliveryCount,
}: {
  matchId: string; inningsId: string; state: InningsState;
  bowlingPlayers: PlayerRef[]; battingPlayers: PlayerRef[]; names: Record<string, string>;
  deliveryCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [bowlerId, setBowlerId] = useState(state.bowlerId ?? bowlingPlayers[0]?.id ?? '');
  const [pendingExtra, setPendingExtra] = useState<null | 'wide' | 'noball' | 'bye' | 'legbye'>(null);
  const [wicketOpen, setWicketOpen] = useState(false);

  const batted = new Set(state.batting.filter((b) => b.balls > 0 || b.out).map((b) => b.playerId));
  const active = new Set([state.strikerId, state.nonStrikerId].filter(Boolean) as string[]);
  const available = battingPlayers.filter((p) => !active.has(p.id) && !batted.has(p.id));

  function send(payload: Omit<DeliveryPayload, 'bowlerId'>) {
    setError(null);
    startTransition(async () => {
      const res = await recordDeliveryAction(matchId, inningsId, { ...payload, bowlerId }, deliveryCount + 1);
      if (res.error) {
        setError(res.error);
        if (/refresh|changed/i.test(res.error)) router.refresh();
      } else router.refresh();
    });
  }

  function onRun(n: number) {
    if (pendingExtra === 'wide') send({ runsBat: 0, extra: 'wide', extraRuns: n, wicket: null });
    else if (pendingExtra === 'noball') send({ runsBat: n, extra: 'noball', extraRuns: 0, wicket: null });
    else if (pendingExtra === 'bye') send({ runsBat: 0, extra: 'bye', extraRuns: n, wicket: null });
    else if (pendingExtra === 'legbye') send({ runsBat: 0, extra: 'legbye', extraRuns: n, wicket: null });
    else send({ runsBat: n, extra: null, extraRuns: 0, wicket: null });
    setPendingExtra(null);
  }

  if (state.complete) {
    return <p className="text-sm font-medium text-muted">Innings complete.</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Bowler</label>
        <select className="input" value={bowlerId} onChange={(e) => setBowlerId(e.target.value)}>
          <option value="" disabled>Select bowler…</option>
          {bowlingPlayers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>

      {pendingExtra && (
        <div className="flex items-center justify-between rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning">
          <span className="font-semibold capitalize">{pendingExtra} — tap runs (0 for none)</span>
          <button className="underline" onClick={() => setPendingExtra(null)}>cancel</button>
        </div>
      )}

      {/* Runs */}
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3, 4, 6].map((n) => (
          <button
            key={n}
            disabled={pending || !bowlerId}
            onClick={() => onRun(n)}
            className={`rounded-xl py-4 text-lg font-bold transition active:scale-95 disabled:opacity-40 ${
              n === 4 ? 'bg-info/15 text-info' : n === 6 ? 'bg-primary text-primary-contrast' : 'bg-surface-2 text-fg'
            }`}
          >
            {n === 0 ? '•' : n}
          </button>
        ))}
        <button
          disabled={pending}
          onClick={() => setWicketOpen(true)}
          className="col-span-2 rounded-xl bg-danger py-4 text-lg font-bold text-white transition active:scale-95"
        >
          Wicket
        </button>
      </div>

      {/* Extras */}
      <div className="grid grid-cols-4 gap-2">
        {(['wide', 'noball', 'bye', 'legbye'] as const).map((ex) => (
          <button
            key={ex}
            disabled={pending || !bowlerId}
            onClick={() => setPendingExtra(pendingExtra === ex ? null : ex)}
            className={`rounded-xl py-3 text-sm font-semibold transition active:scale-95 disabled:opacity-40 ${
              pendingExtra === ex ? 'bg-warning text-white' : 'bg-surface-2 text-muted'
            }`}
          >
            {ex === 'wide' ? 'Wide' : ex === 'noball' ? 'No-ball' : ex === 'bye' ? 'Bye' : 'Leg-bye'}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await undoAction(matchId, inningsId); router.refresh(); })}
          className="btn-outline"
        >
          Undo
        </button>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await endInningsAction(matchId, inningsId); router.refresh(); })}
          className="btn-outline"
        >
          End innings
        </button>
      </div>

      {wicketOpen && (
        <WicketModal
          available={available}
          fielders={bowlingPlayers}
          onCancel={() => setWicketOpen(false)}
          onConfirm={(w) => { setWicketOpen(false); send({ runsBat: 0, extra: null, extraRuns: 0, wicket: w }); }}
        />
      )}
    </div>
  );
}

function WicketModal({
  available, fielders, onCancel, onConfirm,
}: {
  available: PlayerRef[]; fielders: PlayerRef[];
  onCancel: () => void;
  onConfirm: (w: NonNullable<DeliveryPayload['wicket']>) => void;
}) {
  const [type, setType] = useState('bowled');
  const [outEnd, setOutEnd] = useState<'striker' | 'nonstriker'>('striker');
  const [fielderId, setFielderId] = useState('');
  const [incomingBatterId, setIncomingBatterId] = useState(available[0]?.id ?? '');
  const needsFielder = type === 'caught' || type === 'run_out' || type === 'stumped';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="card w-full max-w-md space-y-3 shadow-pop">
        <h3 className="font-semibold">Wicket</h3>
        <div>
          <label className="label">How out</label>
          <select className="input capitalize" value={type} onChange={(e) => setType(e.target.value)}>
            {DISMISSALS.map((d) => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Batter out</label>
          <select className="input" value={outEnd} onChange={(e) => setOutEnd(e.target.value as 'striker' | 'nonstriker')}>
            <option value="striker">Striker</option>
            <option value="nonstriker">Non-striker</option>
          </select>
        </div>
        {needsFielder && (
          <div>
            <label className="label">Fielder</label>
            <select className="input" value={fielderId} onChange={(e) => setFielderId(e.target.value)}>
              <option value="">—</option>
              {fielders.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">New batter</label>
          <select className="input" value={incomingBatterId} onChange={(e) => setIncomingBatterId(e.target.value)}>
            {available.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button
            className="btn"
            onClick={() => onConfirm({ type, outEnd, fielderId: fielderId || null, incomingBatterId: incomingBatterId || null })}
          >
            Confirm wicket
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Scorecard ---------------- */
export function Scorecard({ state, names }: { state: InningsState; names: Record<string, string> }) {
  const nm = (id?: string | null) => (id ? names[id] ?? 'Player' : '—');
  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="mb-2 font-semibold">Batting</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-medium">Batter</th>
                <th className="py-1 text-right font-medium">R</th>
                <th className="py-1 text-right font-medium">B</th>
                <th className="py-1 text-right font-medium">4s</th>
                <th className="py-1 text-right font-medium">6s</th>
                <th className="py-1 text-right font-medium">SR</th>
              </tr>
            </thead>
            <tbody>
              {state.batting.map((b) => (
                <tr key={b.playerId} className="border-t border-divider">
                  <td className="py-1.5">
                    <span className="font-medium">{nm(b.playerId)}</span>
                    <span className="ml-2 text-xs text-muted">
                      {b.out ? b.dismissal : b.balls > 0 || b.playerId === state.strikerId || b.playerId === state.nonStrikerId ? 'not out' : ''}
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular">{b.runs}</td>
                  <td className="py-1.5 text-right tabular">{b.balls}</td>
                  <td className="py-1.5 text-right tabular">{b.fours}</td>
                  <td className="py-1.5 text-right tabular">{b.sixes}</td>
                  <td className="py-1.5 text-right tabular text-muted">{b.strikeRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 flex justify-between border-t border-divider pt-2 text-sm">
          <span className="text-muted">Extras</span>
          <span className="tabular">{state.extras.total} (wd {state.extras.wide}, nb {state.extras.noball}, b {state.extras.bye}, lb {state.extras.legbye})</span>
        </p>
        <p className="flex justify-between text-sm font-bold">
          <span>Total</span>
          <span className="tabular">{state.totalRuns}/{state.wickets} ({state.oversText} ov)</span>
        </p>
      </div>

      <div className="card">
        <h3 className="mb-2 font-semibold">Bowling</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-medium">Bowler</th>
                <th className="py-1 text-right font-medium">O</th>
                <th className="py-1 text-right font-medium">M</th>
                <th className="py-1 text-right font-medium">R</th>
                <th className="py-1 text-right font-medium">W</th>
                <th className="py-1 text-right font-medium">Econ</th>
              </tr>
            </thead>
            <tbody>
              {state.bowling.map((b) => (
                <tr key={b.playerId} className="border-t border-divider">
                  <td className="py-1.5 font-medium">{nm(b.playerId)}</td>
                  <td className="py-1.5 text-right tabular">{oversFromBalls(b.legalBalls)}</td>
                  <td className="py-1.5 text-right tabular">{b.maidens}</td>
                  <td className="py-1.5 text-right tabular">{b.runs}</td>
                  <td className="py-1.5 text-right font-semibold tabular">{b.wickets}</td>
                  <td className="py-1.5 text-right tabular text-muted">
                    {b.legalBalls > 0 ? ((b.runs / b.legalBalls) * 6).toFixed(1) : '0.0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {state.fallOfWickets.length > 0 && (
        <div className="card">
          <h3 className="mb-2 font-semibold">Fall of wickets</h3>
          <div className="flex flex-wrap gap-2">
            {state.fallOfWickets.map((f) => (
              <Badge key={f.wicketNumber} tone="neutral">
                {f.score}-{f.wicketNumber} ({nm(f.outPlayerId)}, {f.over})
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
