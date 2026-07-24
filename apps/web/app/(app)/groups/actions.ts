'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';
import { ACTIVE_GROUP_COOKIE, getActiveGroup } from '@/lib/groups';

export interface ActionState {
  error?: string;
}

const SPORTS = ['cricket', 'football', 'badminton', 'tennis', 'pickleball', 'other'];

/** Create a group; the creator becomes its group_admin and active group. */
export async function createGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const sport = String(formData.get('sport') ?? 'cricket');
  if (name.length < 2) return { error: 'Group name must be at least 2 characters.' };
  if (!SPORTS.includes(sport)) return { error: 'Pick a valid sport.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_group', { p_name: name, p_sport: sport });
  if (error || !data) return { error: error?.message ?? 'Could not create group.' };

  const group = Array.isArray(data) ? data[0] : data;
  (await cookies()).set(ACTIVE_GROUP_COOKIE, group.id, { path: '/' });
  redirect('/dashboard');
}

/** Join an existing group by its invite code (via SECURITY DEFINER RPC). */
export async function joinGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = String(formData.get('code') ?? '')
    .trim()
    .toLowerCase();
  if (!code) return { error: 'Enter an invite code.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('join_group_by_invite', { p_code: code });
  if (error || !data) return { error: 'Invalid invite code.' };

  const group = Array.isArray(data) ? data[0] : data;
  (await cookies()).set(ACTIVE_GROUP_COOKIE, group.id, { path: '/' });
  redirect('/dashboard');
}

/**
 * Promote a member to co-admin (group_admin) or demote back to viewer (player).
 * Admin-only. Co-admins can create matches/teams AND update live scores
 * (can_score_match() returns true for any group admin).
 */
export async function setMemberRoleAction(
  userId: string,
  makeAdmin: boolean,
): Promise<{ error?: string }> {
  const group = await getActiveGroup();
  if (!group) return { error: 'No active group.' };
  if (group.role === 'player') return { error: 'Only admins can change roles.' };

  const me = await getUser();
  if (me?.id === userId) return { error: "You can't change your own role." };
  if (group.owner_id === userId && !makeAdmin) {
    return { error: 'The group owner stays an admin.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('group_members')
    .update({ role: makeAdmin ? 'group_admin' : 'player' })
    .eq('group_id', group.id)
    .eq('user_id', userId);
  if (error) return { error: error.message };

  revalidatePath('/groups');
  return {};
}

/** Switch which group the app is currently showing. */
export async function setActiveGroupAction(formData: FormData): Promise<void> {
  const groupId = String(formData.get('groupId') ?? '');
  if (groupId) (await cookies()).set(ACTIVE_GROUP_COOKIE, groupId, { path: '/' });
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
