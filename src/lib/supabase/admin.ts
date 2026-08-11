import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * The service-role client. Bypasses row-level security entirely.
 *
 * Needed because the match scorer is TypeScript and has to read candidates'
 * psych answers to compute compatibility, while RLS correctly forbids any user
 * from reading another user's row. Ranking therefore runs as trusted server
 * code instead.
 *
 * RULES, and they are not stylistic:
 *
 *   - The `server-only` import above makes this a build error if anything in a
 *     client component ever reaches it, however indirectly.
 *   - SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so it is never
 *     bundled. If you ever see it in the browser, treat the key as burned and
 *     rotate it in the Supabase dashboard.
 *   - Nothing this client reads may be returned to a caller unprojected. Every
 *     value that leaves the server goes through the DTO in `pool.ts`, which
 *     carries no raw psych answers and no date of birth.
 *
 * With RLS bypassed, this file and pool.ts are the whole boundary. Treat a
 * change here the way you would treat a change to an auth check.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasAdminAccess(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
