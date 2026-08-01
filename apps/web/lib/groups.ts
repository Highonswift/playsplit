import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient, getUser } from '@/lib/supabase/server';

export type GroupRole = 'platform_admin' | 'group_admin' | 'player';

export interface CricketRules {
  last_man_stands?: boolean;
  no_byes?: boolean;
}

export interface GroupSummary {
  id: string;
  name: string;
  sport: string;
  cost_model: 'equal' | 'usage' | 'investor' | 'hybrid';
  invite_code: string;
  owner_id: string;
  role: GroupRole;
  cricket_rules: CricketRules;
}

export interface GroupMember {
  user_id: string;
  role: GroupRole;
  full_name: string | null;
  joined_at: string;
}

const ACTIVE_GROUP_COOKIE = 'ps_active_group';

/** All groups the signed-in user is an active member of (cached per request). */
export const getMyGroups = cache(async (): Promise<GroupSummary[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  // RLS lets a member see the whole roster, so scope to OUR own membership rows.
  // NOTE: cricket_rules is fetched separately (see getActiveGroup) so a DB that
  // hasn't run that migration yet can't break group loading entirely.
  const { data } = await supabase
    .from('group_members')
    .select('role, groups(id, name, sport, cost_model, invite_code, owner_id)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });

  return (data ?? [])
    .filter((r) => r.groups)
    .map((r) => {
      const g = r.groups as unknown as Omit<GroupSummary, 'role' | 'cricket_rules'>;
      return { ...g, cricket_rules: {}, role: r.role as GroupRole };
    });
});

/** Cricket rules for a group. Defensive: if the column isn't there yet on an
 *  older DB, fall back to defaults instead of failing the whole request. */
async function fetchCricketRules(groupId: string): Promise<CricketRules> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('groups')
      .select('cricket_rules')
      .eq('id', groupId)
      .maybeSingle();
    if (error || !data) return {};
    return ((data as { cricket_rules?: CricketRules | null }).cricket_rules) ?? {};
  } catch {
    return {};
  }
}

/** The currently-selected group (cookie), falling back to the first membership. */
export const getActiveGroup = cache(async (): Promise<GroupSummary | null> => {
  const groups = await getMyGroups();
  if (groups.length === 0) return null;
  const cookieStore = await cookies();
  const id = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value;
  const base = groups.find((g) => g.id === id) ?? groups[0]!;
  const cricket_rules = await fetchCricketRules(base.id);
  return { ...base, cricket_rules };
});

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
