'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatPaise } from '@playsplit/core';
import {
  recordManualPaymentAction,
  createRazorpayOrderAction,
  type ActionState,
} from '@/app/(app)/wallet/actions';

const INITIAL: ActionState = {};

export function RecordPaymentForm({
  members,
}: {
  members: { user_id: string; full_name: string | null; balance_paise: number }[];
}) {
  const [state, action, pending] = useActionState(recordManualPaymentAction, INITIAL);
  const owing = members.filter((m) => m.balance_paise < 0);
  const list = owing.length > 0 ? owing : members;

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Member</label>
        <select className="input" name="user_id" required defaultValue="">
          <option value="" disabled>
            Select member…
          </option>
          {list.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name ?? 'Unnamed'}
              {m.balance_paise < 0 ? ` — owes ${formatPaise(-m.balance_paise)}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount (₹)</label>
          <input className="input" name="amount" type="number" min="1" placeholder="400" required />
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input" name="method" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-dark">Payment recorded.</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? 'Recording…' : 'Record payment'}
      </button>
    </form>
  );
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

/** Self-service Razorpay pay-down of the user's outstanding balance. */
export function PayButton({ amountPaise }: { amountPaise: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay() {
    setError(null);
    startTransition(async () => {
      const order = await createRazorpayOrderAction(amountPaise);
      if (order.error || !order.orderId) {
        setError(order.error ?? 'Could not start payment.');
        return;
      }
      await new Promise<void>((resolve, reject) => {
        if (window.Razorpay) return resolve();
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve();
        s.onerror = () => reject();
        document.body.appendChild(s);
      });
      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: 'INR',
        order_id: order.orderId,
        name: 'PlaySplit',
        description: 'Wallet payment',
        handler: () => router.refresh(),
      });
      rzp.open();
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn w-full" onClick={pay} disabled={pending}>
        {pending ? 'Starting…' : `Pay ${formatPaise(amountPaise)} now`}
      </button>
    </div>
  );
}
