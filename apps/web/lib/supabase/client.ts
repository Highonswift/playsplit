'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Publishable (new `sb_publishable_…`) or legacy anon key — either works. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser-side Supabase client (RLS-enforced, publishable/anon key). */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
