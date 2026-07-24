'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import {
  assignOfficialAction,
  removeOfficialAction,
  type Result,
} from '@/app/(app)/cricket/matches/[id]/officials-actions';
import { OFFICIAL_ROLES, type Official } from '@/lib/officials-types';
import { Badge } from '@/components/ui';

const INITIAL: Result = {};
const ROLE_LABEL = Object.fromEntries(OFFICIAL_ROLES.map((r) => [r.value, r.label]));

export function OfficialsManager({
  matchId, officials, members,
}: {
  matchId: string;
  officials: Official[];
  members: { user_id: string; full_name: string | null }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(assignOfficialAction, INITIAL);
  const [removing, startRemove] = useTransition();

  return (
    <div className="space-y-3">
      {officials.length > 0 && (
        <ul className="divide-y divide-divider">
          {officials.map((o) => (
            <li key={o.user_id} className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm font-medium">{o.full_name ?? 'Member'}</span>
                <span className="ml-2 text-xs text-muted">{ROLE_LABEL[o.role] ?? o.role}</span>
              </div>
              <div className="flex items-center gap-2">
                {o.can_score && <Badge tone="primary">can score</Badge>}
                <button
                  aria-label="Remove official"
                  className="rounded-lg p-1 text-muted hover:bg-surface-2"
                  disabled={removing}
                  onClick={() => startRemove(async () => { await removeOfficialAction(matchId, o.user_id); router.refresh(); })}
                >
                  <X size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-3 border-t border-divider pt-3">
        <input type="hidden" name="match_id" value={matchId} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Member</label>
            <select className="input" name="user_id" required defaultValue="">
              <option value="" disabled>Select…</option>
              {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? 'Member'}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" name="role" defaultValue="umpire1">
              {OFFICIAL_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="can_score" className="h-4 w-4 accent-[var(--primary)]" defaultChecked />
          Can update the live score
        </label>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {state.ok && <p className="text-sm text-primary-dark">Official assigned.</p>}
        <button className="btn w-full" disabled={pending}>{pending ? 'Assigning…' : 'Assign official'}</button>
      </form>
    </div>
  );
}
