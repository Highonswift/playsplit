'use client';

import { useActionState } from 'react';
import {
  createGroundAction,
  createSubscriptionAction,
  type ActionState,
} from '@/app/(app)/grounds/actions';

const INITIAL: ActionState = {};

export function CreateGroundForm() {
  const [state, action, pending] = useActionState(createGroundAction, INITIAL);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Ground name</label>
        <input className="input" name="name" placeholder="Greenfield Turf" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Hourly rate (₹)</label>
          <input className="input" name="hourly_rate" type="number" min="1" placeholder="600" required />
        </div>
        <div>
          <label className="label">Contact (optional)</label>
          <input className="input" name="contact" placeholder="Manager" />
        </div>
      </div>
      <div>
        <label className="label">Address (optional)</label>
        <input className="input" name="address" placeholder="Sector 12, Bengaluru" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-dark">Ground added.</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? 'Adding…' : 'Add ground'}
      </button>
    </form>
  );
}

export function PurchaseSubscriptionForm({ grounds }: { grounds: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createSubscriptionAction, INITIAL);
  const today = new Date().toISOString().slice(0, 10);

  if (grounds.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Add a ground first to buy a subscription.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Subscription name</label>
        <input className="input" name="name" placeholder="July Subscription" required />
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
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Cost (₹)</label>
          <input className="input" name="cost" type="number" min="1" placeholder="8000" required />
        </div>
        <div>
          <label className="label">Hours</label>
          <input className="input" name="hours" type="number" min="1" step="0.5" placeholder="20" required />
        </div>
        <div>
          <label className="label">Valid (days)</label>
          <input className="input" name="validity_days" type="number" min="1" placeholder="30" required />
        </div>
      </div>
      <div>
        <label className="label">Start date</label>
        <input className="input" name="start_date" type="date" defaultValue={today} />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-dark">Subscription purchased.</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Purchase subscription'}
      </button>
    </form>
  );
}
