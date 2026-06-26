import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Server-side Supabase client (RLS-enforced, reads the user session cookie). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — safe to ignore (middleware refreshes).
          }
        },
      },
    },
  );
}

/**
 * Service-role client — bypasses RLS. Use ONLY inside server actions / route
 * handlers for privileged ledger and settlement writes (PRD §28 audit spine).
 * Never import this into a Client Component.
 */
export function createServiceClient() {
  const { createClient: createSb } = require('@supabase/supabase-js');
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
