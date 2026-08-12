'use server';

import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server.ts';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Straight to the landing page rather than back where they were — most of
  // the app is meaningless signed out, and bouncing off a redirect is worse.
  redirect('/');
}
