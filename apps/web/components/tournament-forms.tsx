'use client';

import { useActionState } from 'react';
import { createTournamentAction, registerTeamAction, type Result } from '@/app/(app)/cricket/tournament-actions';

const INITIAL: Result = {};

const FORMATS = [
  { v: 'league', l: 'League' },
  { v: 'knockout', l: 'Knockout' },
  { v: 'round_robin', l: 'Round robin' },
  { v: 'group_knockout', l: 'Group + knockout' },
  { v: 'custom', l: 'Custom' },
];

export function CreateTournamentForm() {
  const [state, action, pending] = useActionState(createTournamentAction, INITIAL);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Tournament name</label>
        <input className="input" name="name" placeholder="Summer Cup 2026" required />
      </div>
      <div>
        <label className="label">Format</label>
        <select className="input" name="format" defaultValue="league">
          {FORMATS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
        </select>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? 'Creating…' : 'Create tournament'}</button>
    </form>
  );
}

export function RegisterTeamForm({
  tournamentId, teams,
}: {
  tournamentId: string; teams: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(registerTeamAction, INITIAL);
  if (teams.length === 0) return <p className="text-sm text-muted">All teams are registered.</p>;
  return (
    <form action={action} className="flex gap-2">
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <select className="input" name="team_id" required defaultValue="">
        <option value="" disabled>Add a team…</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <button className="btn shrink-0" disabled={pending}>{pending ? '…' : 'Register'}</button>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
