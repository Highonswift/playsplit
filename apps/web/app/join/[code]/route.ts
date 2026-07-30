import { NextResponse, type NextRequest } from 'next/server';
import { createClient, getUser } from '@/lib/supabase/server';
import { ACTIVE_GROUP_COOKIE } from '@/lib/groups';

/**
 * One-tap invite link: pitchlive.../join/<code>
 * - Not signed in → send to login/signup, remembering where to return.
 * - Signed in → join the group by its code, make it active, land on dashboard.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clean = code.trim().toLowerCase();

  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=/join/${clean}`, req.url));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('join_group_by_invite', { p_code: clean });
  const group = Array.isArray(data) ? data[0] : data;

  if (error || !group?.id) {
    // Bad/expired code — drop them on groups with a hint.
    return NextResponse.redirect(new URL('/groups?invite=invalid', req.url));
  }

  const res = NextResponse.redirect(new URL('/dashboard', req.url));
  res.cookies.set(ACTIVE_GROUP_COOKIE, group.id, { path: '/' });
  return res;
}
