'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Shuffle, X, Plus, Zap } from 'lucide-react';
import {
  addPoolPlayersAction,
  removePoolPlayerAction,
  createPickupMatchAction,
} from '@/app/(app)/cricket/actions';
import { addMatchPlayerAction } from '@/app/(app)/cricket/matches/[id]/scoring-actions';

interface Player {
  id: string;
  full_name: string;
}

/** Add / remove names in the group's pickup pool. */
export function PoolManager({ players }: { players: Player[] }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const add = () =>
    start(async () => {
      setError(null);
      // Accept several at once: one per line or comma-separated.
      const names = text.split(/[\n,]+/).map((n) => n.trim()).filter(Boolean);
      if (names.length === 0) return;
      const res = await addPoolPlayersAction(names);
      if (res.error) setError(res.error);
      else {
        setText('');
        router.refresh();
      }
    });

  const remove = (id: string) =>
    start(async () => {
      const res = await removePoolPlayerAction(id);
      if (res.error) setError(res.error);
      else router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="label">Add players (one per line, or comma-separated)</label>
        <textarea
          className="input min-h-20"
          placeholder={'Rajesh\nArul\nPravin, Ragul, Prabha'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn w-full" onClick={add} disabled={pending || !text.trim()}>
          <Plus size={16} /> Add to pool
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      {players.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {players.map((p) => (
            <li key={p.id} className="chip flex items-center gap-1.5">
              {p.full_name}
              <button
                onClick={() => remove(p.id)}
                disabled={pending}
                aria-label={`Remove ${p.full_name}`}
                className="text-muted hover:text-danger"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Add a late-arriving player to a side, mid-match (pickup mode). */
export function LatePlayerAdder({
  matchId,
  teams,
  available,
}: {
  matchId: string;
  teams: { id: string; name: string }[];
  available: Player[];
}) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState('');
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [isShared, setIsShared] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const add = () =>
    start(async () => {
      setError(null);
      if (!playerId || !teamId) {
        setError('Pick a player and a side.');
        return;
      }
      const res = await addMatchPlayerAction(matchId, teamId, playerId, isShared);
      if (res.error) setError(res.error);
      else {
        setPlayerId('');
        setIsShared(false);
        router.refresh();
      }
    });

  if (available.length === 0) {
    return <p className="text-sm text-muted">Everyone in the pool is already playing.</p>;
  }

  return (
    <div className="space-y-2">
      <select className="input" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
        <option value="">Select player…</option>
        {available.map((p) => (
          <option key={p.id} value={p.id}>{p.full_name}</option>
        ))}
      </select>
      <select
        className="input"
        value={isShared ? 'shared' : teamId}
        onChange={(e) => {
          if (e.target.value === 'shared') setIsShared(true);
          else {
            setIsShared(false);
            setTeamId(e.target.value);
          }
        }}
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
        <option value="shared">Shared (both sides)</option>
      </select>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="btn w-full" onClick={add} disabled={pending || !playerId}>
        <Plus size={16} /> {pending ? 'Adding…' : 'Add player'}
      </button>
    </div>
  );
}

type Side = 'A' | 'B' | 'S';

/** Daily pickup setup: pick who's here, auto-split, mark a shared player, play. */
export function PickupSetup({ pool }: { pool: Player[] }) {
  const router = useRouter();
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [side, setSide] = useState<Record<string, Side>>({});
  const [sideAName, setSideAName] = useState('Side A');
  const [sideBName, setSideBName] = useState('Side B');
  const [overs, setOvers] = useState(8);
  const [quickAdd, setQuickAdd] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nameOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of pool) m[p.id] = p.full_name;
    return m;
  }, [pool]);

  const presentIds = [...present];
  const counts = useMemo(() => {
    let a = 0, b = 0, s = 0;
    for (const id of presentIds) {
      const v = side[id];
      if (v === 'A') a++;
      else if (v === 'B') b++;
      else if (v === 'S') s++;
    }
    return { a, b, s, unassigned: presentIds.length - a - b - s };
  }, [presentIds, side]);

  const togglePresent = (id: string) =>
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSide((s) => {
          const c = { ...s };
          delete c[id];
          return c;
        });
      } else {
        next.add(id);
      }
      return next;
    });

  const autoSplit = () => {
    const ids = [...present];
    // Fisher–Yates shuffle.
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    const next: Record<string, Side> = {};
    let rest = ids;
    if (ids.length % 2 === 1) {
      next[ids[ids.length - 1]!] = 'S'; // odd one out plays for both
      rest = ids.slice(0, -1);
    }
    const half = rest.length / 2;
    rest.forEach((id, i) => (next[id] = i < half ? 'A' : 'B'));
    setSide(next);
  };

  const setPlayerSide = (id: string, v: Side) =>
    setSide((s) => ({ ...s, [id]: s[id] === v ? undefined! : v }));

  const doQuickAdd = () =>
    start(async () => {
      const names = quickAdd.split(/[\n,]+/).map((n) => n.trim()).filter(Boolean);
      if (names.length === 0) return;
      const res = await addPoolPlayersAction(names);
      if (res.error) setError(res.error);
      else {
        setQuickAdd('');
        router.refresh();
      }
    });

  const startGame = () =>
    start(async () => {
      setError(null);
      const sideA = presentIds.filter((id) => side[id] === 'A');
      const sideB = presentIds.filter((id) => side[id] === 'B');
      const shared = presentIds.filter((id) => side[id] === 'S');
      if (sideA.length === 0 || sideB.length === 0) {
        setError('Assign at least one player to each side (use Auto-split).');
        return;
      }
      const res = await createPickupMatchAction({
        sideAName,
        sideBName,
        sideA,
        sideB,
        shared,
        overs: overs > 0 ? overs : null,
      });
      if (res?.error) setError(res.error);
      // On success the action redirects to the match page.
    });

  if (pool.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-sm text-muted">
          Your player pool is empty. Add your regulars first.
        </p>
        <a href="/cricket/pool" className="btn mt-3 inline-flex">Go to player pool</a>
      </div>
    );
  }

  const sideCls = (id: string, v: Side) =>
    `flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
      side[id] === v
        ? v === 'S'
          ? 'bg-warning text-white'
          : 'bg-primary text-white'
        : 'border border-border text-muted'
    }`;

  return (
    <div className="space-y-5">
      {/* 1. Who's here */}
      <div className="card">
        <h2 className="mb-1 font-semibold">Who&apos;s here today?</h2>
        <p className="stat-label mb-3">Tap everyone who turned up ({present.size} selected)</p>
        <ul className="flex flex-wrap gap-2">
          {pool.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => togglePresent(p.id)}
                className={`chip ${present.has(p.id) ? 'bg-primary text-white' : ''}`}
              >
                {p.full_name}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Add a newcomer…"
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
          />
          <button className="btn-outline shrink-0" onClick={doQuickAdd} disabled={pending || !quickAdd.trim()}>
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {/* 2. Split into sides */}
      {present.size >= 2 && (
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Split into two sides</h2>
            <button className="btn-outline" onClick={autoSplit}>
              <Shuffle size={15} /> Auto-split
            </button>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <input className="input" value={sideAName} onChange={(e) => setSideAName(e.target.value)} />
            <input className="input" value={sideBName} onChange={(e) => setSideBName(e.target.value)} />
          </div>
          <p className="stat-label mb-3">
            {sideAName}: {counts.a} · {sideBName}: {counts.b}
            {counts.s > 0 && ` · Shared: ${counts.s}`}
            {counts.unassigned > 0 && ` · Unassigned: ${counts.unassigned}`}
          </p>

          <ul className="space-y-2">
            {presentIds.map((id) => (
              <li key={id} className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm font-medium">{nameOf[id]}</span>
                <div className="flex w-40 gap-1">
                  <button className={sideCls(id, 'A')} onClick={() => setPlayerSide(id, 'A')}>A</button>
                  <button className={sideCls(id, 'B')} onClick={() => setPlayerSide(id, 'B')}>B</button>
                  <button className={sideCls(id, 'S')} onClick={() => setPlayerSide(id, 'S')} title="Shared — plays for both sides">⇄</button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            ⇄ = shared player (odd numbers): bats &amp; fields for both sides.
          </p>
        </div>
      )}

      {/* 3. Overs + go */}
      {present.size >= 2 && (
        <div className="card space-y-3">
          <div className="flex items-center gap-3">
            <label className="label flex-1">Overs per side</label>
            <input
              type="number"
              min={1}
              className="input w-24"
              value={overs}
              onChange={(e) => setOvers(Number(e.target.value))}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button className="btn w-full" onClick={startGame} disabled={pending}>
            <Zap size={16} /> {pending ? 'Starting…' : 'Start game'}
          </button>
        </div>
      )}
    </div>
  );
}
