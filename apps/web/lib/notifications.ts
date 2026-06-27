import { createClient } from '@/lib/supabase/server';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as Notification[];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  return count ?? 0;
}
