'use client';

import { useActionState } from 'react';
import {
  createTeamAction,
  addPlayerAction,
  createMatchAction,
  recordTossAction,
  type ActionState,
} from '@/app/(app)/cricket/actions';
import { FORMAT_LABELS, ROLE_LABELS, type CricketFormat, type CricketRole, type TeamRef } from '@/lib/cricket-types';

const INITIAL: ActionState = {};

const BATTING = [
  { v: 'rhb', l: 'Right-hand bat' },
  { v: 'lhb', l: 'Left-hand bat' },
];
const BOWLING = [
  { v: 'none', l: 'Does not bowl' },
  { v: 'right_fast', l: 'Right-arm fast' },
  { v: 'right_medium', l: 'Right-arm medium' },
  { v: 'right_offspin', l: 'Right-arm off-spin' },
  { v: 'right_legspin', l: 'Right-arm leg-spin' },
  { v: 'left_fast', l: 'Left-arm fast' },
  { v: 'left_medium', l: 'Left-arm medium' },
  { v: 'left_orthodox', l: 'Left-arm orthodox' },
  { v: 'left_wrist', l: 'Left-arm wrist-spin' },
];

export function CreateTeamForm() {
  const [state, action, pending] = useActionState(createTeamAction, INITIAL);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Team name</label>
        <input className="input" name="name" placeholder="Royal Strikers" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Short name</label>
          <input className="input uppercase" name="short_name" placeholder="RS" maxLength={4} />
        </div>
        <div>
          <label className="label">Colour</label>
          <input className="input h-[42px] p-1" name="color" type="color" defaultValue="#16a34a" />
        </div>
      </div>
      <div>
        <label className="label">City (optional)</label>
        <input className="input" name="city" placeholder="Bengaluru" />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? 'Creating…' : 'Create team'}
      </button>
    </form>
  );
}

export function AddPlayerForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState(addPlayerAction, INITIAL);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="team_id" value={teamId} />
      <div className="grid grid-cols-[1fr,90px] gap-3">
        <div>
          <label className="label">Player name</label>
          <input className="input" name="full_name" placeholder="S. Anand" required />
        </div>
        <div>
          <label className="label">Jersey</label>
          <input className="input" name="jersey_number" type="number" min="0" placeholder="7" />
        </div>
      </div>
      <div>
        <label className="label">Role</label>
        <select className="input" name="role" defaultValue="batter">
          {(Object.keys(ROLE_LABELS) as CricketRole[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Batting</label>
          <select className="input" name="batting" defaultValue="rhb">
            {BATTING.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Bowling</label>
          <select className="input" name="bowling" defaultValue="none">
            {BOWLING.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
          </select>
        </div>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-primary-dark">Player added.</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? 'Adding…' : 'Add player'}
      </button>
    </form>
  );
}

export function CreateMatchForm({
  teams, tournaments = [],
}: {
  teams: TeamRef[];
  tournaments?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createMatchAction, INITIAL);
  const today = new Date().toISOString().slice(0, 10);
  if (teams.length < 2) {
    return <p className="text-sm text-muted">Create at least two teams to set up a match.</p>;
  }
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Match name (optional)</label>
        <input className="input" name="name" placeholder="Final" />
      </div>
      {tournaments.length > 0 && (
        <div>
          <label className="label">Tournament (optional)</label>
          <select className="input" name="tournament_id" defaultValue="">
            <option value="">Friendly / standalone</option>
            {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Team A</label>
          <select className="input" name="team_a_id" required defaultValue={teams[0]!.id}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Team B</label>
          <select className="input" name="team_b_id" required defaultValue={teams[1]!.id}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Format</label>
          <select className="input" name="format" defaultValue="t20">
            {(Object.keys(FORMAT_LABELS) as CricketFormat[]).map((f) => (
              <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Overs (blank = default)</label>
          <input className="input" name="overs" type="number" min="1" placeholder="20" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Players / side</label>
          <input className="input" name="players_per_side" type="number" min="2" defaultValue={11} />
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" name="match_date" type="date" defaultValue={today} />
        </div>
      </div>
      <div>
        <label className="label">Venue (optional)</label>
        <input className="input" name="venue" placeholder="Greenfield Turf" />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? 'Creating…' : 'Create match'}
      </button>
    </form>
  );
}

export function TossForm({
  matchId,
  teamA,
  teamB,
}: {
  matchId: string;
  teamA: TeamRef;
  teamB: TeamRef;
}) {
  const [state, action, pending] = useActionState(recordTossAction, INITIAL);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="match_id" value={matchId} />
      <div>
        <label className="label">Toss won by</label>
        <select className="input" name="toss_winner_team_id" required defaultValue={teamA.id}>
          <option value={teamA.id}>{teamA.name}</option>
          <option value={teamB.id}>{teamB.name}</option>
        </select>
      </div>
      <div>
        <label className="label">Elected to</label>
        <select className="input" name="toss_decision" defaultValue="bat">
          <option value="bat">Bat first</option>
          <option value="bowl">Bowl first</option>
        </select>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Record toss'}
      </button>
    </form>
  );
}
