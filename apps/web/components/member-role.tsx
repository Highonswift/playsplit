'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Shield } from 'lucide-react';
import { setMemberRoleAction } from '@/app/(app)/groups/actions';

/** Admin-only toggle: promote a member to co-admin, or demote to viewer. */
export function MemberRoleButton({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () =>
    start(async () => {
      setError(null);
      const res = await setMemberRoleAction(userId, !isAdmin);
      if (res.error) setError(res.error);
      else router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={pending}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${
          isAdmin
            ? 'border-[var(--border)] text-[var(--muted)]'
            : 'border-brand bg-brand-light text-brand-dark'
        }`}
      >
        {isAdmin ? <Shield size={12} /> : <Crown size={12} />}
        {pending ? '…' : isAdmin ? 'Make viewer' : 'Make co-admin'}
      </button>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}
