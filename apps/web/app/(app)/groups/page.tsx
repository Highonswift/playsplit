import { Users, Crown } from 'lucide-react';
import { getMyGroups, getActiveGroup, getGroupMembers } from '@/lib/groups';
import { CreateGroupForm, JoinGroupForm, InviteCode } from '@/components/group-forms';
import { setActiveGroupAction } from './actions';

export default async function GroupsPage() {
  const [groups, active] = await Promise.all([getMyGroups(), getActiveGroup()]);
  const members = active ? await getGroupMembers(active.id) : [];

  // Onboarding: no groups yet.
  if (groups.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Welcome to PlaySplit</h1>
          <p className="text-sm text-[var(--muted)]">
            Create a group for your team, or join one with an invite code.
          </p>
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Create a group</h2>
          <CreateGroupForm />
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Join with a code</h2>
          <JoinGroupForm />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Groups</h1>

      {/* Group switcher */}
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <form key={g.id} action={setActiveGroupAction}>
              <input type="hidden" name="groupId" value={g.id} />
              <button
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  g.id === active?.id
                    ? 'bg-brand text-white'
                    : 'border border-[var(--border)] bg-white text-[var(--muted)]'
                }`}
              >
                {g.name}
              </button>
            </form>
          ))}
        </div>
      )}

      {active && (
        <>
          <div className="card">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">{active.name}</h2>
                <p className="text-sm capitalize text-[var(--muted)]">
                  {active.sport} · {active.cost_model} cost-sharing
                </p>
              </div>
              <span className="rounded-full bg-brand-light px-2.5 py-1 text-xs font-semibold capitalize text-brand-dark">
                {active.role.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-4">
              <p className="stat-label mb-1">Invite code — share to add players</p>
              <InviteCode code={active.invite_code} />
            </div>
          </div>

          <div className="card">
            <div className="mb-3 flex items-center gap-2">
              <Users size={16} className="text-[var(--muted)]" />
              <h2 className="font-semibold">Members ({members.length})</h2>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium">{m.full_name ?? 'Unnamed player'}</span>
                  <span className="flex items-center gap-1 text-xs capitalize text-[var(--muted)]">
                    {m.role !== 'player' && <Crown size={13} className="text-amber-500" />}
                    {m.role.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <details className="card">
        <summary className="cursor-pointer font-semibold">Create or join another group</summary>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <CreateGroupForm />
          <JoinGroupForm />
        </div>
      </details>
    </div>
  );
}
