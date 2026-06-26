import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type GroupRole = 'platform_admin' | 'group_admin' | 'player';

export interface GroupSummary {
  id: string;
  name: string;
  sport: string;
  cost_model: 'equal' | 'usage' | 'investor' | 'hybrid';
  invite_code: string;
  role: GroupRole;
}

export interface GroupMember {
  user_id: string;
  role: GroupRole;
  full_name: string | null;
  joined_at: string;
}

const ACTIVE_GROUP_COOKIE = 'ps_active_group';

/** All groups the signed-in user is an active member of. */
export async function getMyGroups(): Promise<GroupSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // RLS lets a member see the whole roster, so scope to OUR own membership rows.
  const { data } = await supabase
    .from('group_members')
    .select('role, groups(id, name, sport, cost_model, invite_code)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });

  return (data ?? [])
    .filter((r) => r.groups)
    .map((r) => {
      const g = r.groups as unknown as Omit<GroupSummary, 'role'>;
      return { ...g, role: r.role as GroupRole };
    });
}

/** The currently-selected group (cookie), falling back to the first membership. */
export async function getActiveGroup(): Promise<GroupSummary | null> {
  const groups = await getMyGroups();
  if (groups.length === 0) return null;
  const cookieStore = await cookies();
  const id = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value;
  return groups.find((g) => g.id === id) ?? groups[0]!;
}

/** Roster of a group (members + their profile names). */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('group_members')
    .select('user_id, role, joined_at, profiles(full_name)')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });

  return (data ?? []).map((r) => ({
    user_id: r.user_id,
    role: r.role as GroupRole,
    joined_at: r.joined_at,
    full_name: (r.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }));
}

export { ACTIVE_GROUP_COOKIE };
