'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CostModel } from '@playsplit/core';
import {
  updateProfileAction,
  updateCostModelAction,
  updateCricketRuleAction,
  type ActionState,
} from '@/app/(app)/settings/actions';

const INITIAL: ActionState = {};

/** Admin toggle for a per-group cricket rule. */
export function CricketRuleToggle({
  rule,
  label,
  hint,
  enabled,
}: {
  rule: 'last_man_stands' | 'no_byes';
  label: string;
  hint: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () =>
    start(async () => {
      setError(null);
      const next = !on;
      setOn(next); // optimistic
      const res = await updateCricketRuleAction(rule, next);
      if (res.error) {
        setOn(!next);
        setError(res.error);
      } else {
        router.refresh();
      }
    });

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="stat-label">{hint}</p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          onClick={toggle}
          disabled={pending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-primary' : 'bg-surface-2'} disabled:opacity-50`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

const MODEL_LABELS: Record<CostModel, string> = {
  equal: 'Equal — split evenly',
  usage: 'Usage-based — by minutes played',
  investor: 'Investor — subscribers recover from occasional players',
  hybrid: 'Hybrid — co-owners split equally, guests pay per use',
};

export function ProfileForm({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, INITIAL);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Display name</label>
        <input className="input" name="full_name" defaultValue={fullName} placeholder="Your name" required />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-dark">Saved.</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Save name'}
      </button>
    </form>
  );
}

export function CostModelForm({ current }: { current: CostModel }) {
  const [state, action, pending] = useActionState(updateCostModelAction, INITIAL);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Cost-sharing model</label>
        <select className="input" name="cost_model" defaultValue={current}>
          {(Object.keys(MODEL_LABELS) as CostModel[]).map((m) => (
            <option key={m} value={m}>
              {MODEL_LABELS[m]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--muted)]">Applies to matches settled from now on.</p>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-dark">Cost model updated.</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Update cost model'}
      </button>
    </form>
  );
}
