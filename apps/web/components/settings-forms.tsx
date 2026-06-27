'use client';

import { useActionState } from 'react';
import type { CostModel } from '@playsplit/core';
import {
  updateProfileAction,
  updateCostModelAction,
  type ActionState,
} from '@/app/(app)/settings/actions';

const INITIAL: ActionState = {};

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
