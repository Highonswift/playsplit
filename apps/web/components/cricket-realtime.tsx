'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Hand } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { takeControlAction } from '@/app/(app)/cricket/matches/[id]/officials-actions';

/**
 * Subscribes to Supabase Realtime for this match so spectators and other umpires
 * see every ball, innings change and control transfer live — no refresh (§11.3, §14).
 */
export function LiveSync({ matchId, inningsId }: { matchId: string; inningsId?: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const onChange = () => router.refresh();
    const ch = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cricket_matches', filter: `id=eq.${matchId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cricket_innings', filter: `match_id=eq.${matchId}` }, onChange);
    if (inningsId) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'cricket_deliveries', filter: `innings_id=eq.${inningsId}` }, onChange);
    }

    // RLS-gated postgres_changes require the realtime socket to carry the user's JWT.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      ch.subscribe();
    });

    return () => {
      supabase.removeChannel(ch);
    };
  }, [matchId, inningsId, router]);
  return null;
}

/** Shows who currently holds scoring control and lets an authorised umpire take it. */
export function ControlBar({
  matchId, controllerName, iAmController, canScore,
}: {
  matchId: string; controllerName: string | null; iAmController: boolean; canScore: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!controllerName && !canScore) return null;

  return (
    <div className="card flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <Radio size={16} className="text-live" />
        {iAmController ? (
          <span className="font-semibold text-primary-dark">You are scoring</span>
        ) : controllerName ? (
          <span><span className="font-semibold">{controllerName}</span> is scoring</span>
        ) : (
          <span className="text-muted">No one is scoring yet</span>
        )}
      </div>
      {canScore && !iAmController && (
        <button
          className="btn-outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await takeControlAction(matchId);
              if (r.error) setError(r.error);
              else router.refresh();
            })
          }
        >
          <Hand size={15} /> Take control
        </button>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
