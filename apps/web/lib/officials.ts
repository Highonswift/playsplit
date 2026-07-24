import { createClient } from '@/lib/supabase/server';
import type { Official } from '@/lib/officials-types';

export * from '@/lib/officials-types';

export async function getOfficials(matchId: string): Promise<Official[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cricket_officials')
    .select('user_id, role, can_score, profiles(full_name)')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((o) => ({
    user_id: o.user_id,
    role: o.role,
    can_score: o.can_score,
    full_name: (o.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }));
}
