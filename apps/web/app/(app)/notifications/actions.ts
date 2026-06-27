'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/** Mark all of the signed-in user's notifications as read. */
export async function markAllReadAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
    .eq('user_id', user.id);
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
}
