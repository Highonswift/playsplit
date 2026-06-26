'use client';

import { useActionState, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import {
  createGroupAction,
  joinGroupAction,
  type ActionState,
} from '@/app/(app)/groups/actions';

const SPORTS = ['cricket', 'football', 'badminton', 'tennis', 'pickleball', 'other'];
const INITIAL: ActionState = {};

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroupAction, INITIAL);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Group name</label>
        <input className="input" name="name" placeholder="Saturday Cricket" required />
      </div>
      <div>
        <label className="label">Sport</label>
        <select className="input capitalize" name="sport" defaultValue="cricket">
          {SPORTS.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? 'Creating…' : 'Create group'}
      </button>
    </form>
  );
}

export function JoinGroupForm() {
  const [state, action, pending] = useActionState(joinGroupAction, INITIAL);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Invite code</label>
        <input
          className="input font-mono tracking-wide"
          name="code"
          placeholder="e.g. 9f3a2b1c"
          required
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-outline w-full" disabled={pending}>
        {pending ? 'Joining…' : 'Join group'}
      </button>
    </form>
  );
}

/** Shows the invite code with a copy-to-clipboard button. */
export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-slate-50 px-3 py-2 font-mono text-sm font-semibold tracking-wide transition hover:bg-slate-100"
    >
      {code}
      {copied ? <Check size={15} className="text-brand" /> : <Copy size={15} className="text-[var(--muted)]" />}
    </button>
  );
}
