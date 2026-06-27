'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createMatchAction,
  saveAttendanceAction,
  settleMatchAction,
  type ActionState,
  type AttendanceInput,
} from '@/app/(app)/matches/actions';
import type { AttendanceRow } from '@/lib/matches';

const INITIAL: ActionState = {};

export function CreateMatchForm({
  grounds,
  subscriptions,
}: {
  grounds: { id: string; name: string }[];
  subscriptions: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createMatchAction, INITIAL);
  const today = new Date().toISOString().slice(0, 10);

  if (grounds.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Add a ground first to create matches.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Date</label>
        <input className="input" name="match_date" type="date" defaultValue={today} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Start</label>
          <input className="input" name="start_time" type="time" defaultValue="06:00" required />
        </div>
        <div>
          <label className="label">End</label>
          <input className="input" name="end_time" type="time" defaultValue="08:00" required />
        </div>
      </div>
      <div>
        <label className="label">Ground</label>
        <select className="input" name="ground_id" required defaultValue={grounds[0]!.id}>
          {grounds.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Subscription (optional)</label>
        <select className="input" name="subscription_id" defaultValue="">
          <option value="">No subscription — pay hourly</option>
          {subscriptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? 'Creating…' : 'Create match'}
      </button>
    </form>
  );
}

interface RowState {
  present: boolean;
  minutes: number;
  investor: boolean;
}

export function AttendanceEditor({
  matchId,
  rows,
  durationMins,
  editable,
}: {
  matchId: string;
  rows: AttendanceRow[];
  durationMins: number;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.user_id,
        {
          present: r.present,
          minutes: r.billable_minutes || durationMins,
          investor: r.is_investor,
        },
      ]),
    ),
  );

  function update(uid: string, patch: Partial<RowState>) {
    setState((s) => ({ ...s, [uid]: { ...s[uid]!, ...patch } }));
    setSaved(false);
  }

  function save() {
    setError(null);
    const payload: AttendanceInput[] = rows.map((r) => ({
      userId: r.user_id,
      present: state[r.user_id]!.present,
      billableMinutes: state[r.user_id]!.minutes,
      isInvestor: state[r.user_id]!.investor,
    }));
    startTransition(async () => {
      const res = await saveAttendanceAction(matchId, payload);
      if (res.error) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-[var(--border)]">
        {rows.map((r) => {
          const st = state[r.user_id]!;
          return (
            <li key={r.user_id} className="py-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={st.present}
                    disabled={!editable}
                    onChange={(e) => update(r.user_id, { present: e.target.checked })}
                  />
                  <span className="text-sm font-medium">{r.full_name ?? 'Unnamed player'}</span>
                </label>
                {st.present && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-amber-500"
                        checked={st.investor}
                        disabled={!editable}
                        onChange={(e) => update(r.user_id, { investor: e.target.checked })}
                      />
                      investor
                    </label>
                    <input
                      type="number"
                      className="w-20 rounded-lg border border-[var(--border)] px-2 py-1 text-right text-sm"
                      value={st.minutes}
                      min={0}
                      max={durationMins}
                      disabled={!editable}
                      onChange={(e) => update(r.user_id, { minutes: Number(e.target.value) })}
                    />
                    <span className="text-xs text-[var(--muted)]">min</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {editable && (
        <button className="btn-outline w-full" onClick={save} disabled={pending}>
          {pending ? 'Saving…' : saved ? 'Saved ✓' : 'Save attendance'}
        </button>
      )}
    </div>
  );
}

export function SettleButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function settle() {
    setError(null);
    startTransition(async () => {
      const res = await settleMatchAction(matchId);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn w-full" onClick={settle} disabled={pending}>
        {pending ? 'Settling…' : 'Settle match'}
      </button>
    </div>
  );
}
