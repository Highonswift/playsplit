import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Support both the new key format (sb_publishable_… / sb_secret_…) and the
// legacy anon / service_role keys — whichever is configured.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Server-side Supabase client (RLS-enforced, reads the user session cookie). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    URL,
    PUBLISHABLE_KEY,
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
  return createSb(URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
