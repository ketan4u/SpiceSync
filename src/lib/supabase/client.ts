'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase in the browser.
 *
 * Uses the NEXT_PUBLIC_ pair, which is genuinely public — it is embedded in the
 * bundle and anyone can read it. That is the intended design: the anon key
 * identifies the project, and row-level security decides what the holder may
 * actually do. It is not a secret, and it must never be confused with the
 * service_role key, which bypasses RLS entirely.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
