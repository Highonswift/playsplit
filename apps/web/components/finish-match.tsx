'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { finishMatchAction } from '@/app/(app)/cricket/matches/[id]/scoring-actions';

/** Declare the match result (winner or tie) — writes the final scorecard state. */
export function FinishMatchButtons({
  matchId, teamA, teamB,
}: {
  matchId: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function finish(winnerId: string | null, text: string) {
    setError(null);
    startTransition(async () => {
      const res = await finishMatchAction(matchId, winnerId, text);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="grid gap-2">
        <button className="btn" disabled={pending} onClick={() => finish(teamA.id, `${teamA.name} won`)}>
          {teamA.name} won
        </button>
        <button className="btn" disabled={pending} onClick={() => finish(teamB.id, `${teamB.name} won`)}>
          {teamB.name} won
        </button>
        <button className="btn-outline" disabled={pending} onClick={() => finish(null, 'Match tied')}>
          Match tied
        </button>
      </div>
    </div>
  );
}
