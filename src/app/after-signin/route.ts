import { NextResponse, type NextRequest } from 'next/server';
import { isAdminEmail } from '@/lib/admin/guard.ts';
import { createAdminClient } from '@/lib/supabase/admin.ts';
import { createClient } from '@/lib/supabase/server.ts';

/**
 * Where someone lands after signing in.
 *
 * Sign-in used to send everyone to onboarding, which meant a moderator had to
 * fill in who they were looking for before they could reach a report queue.
 * Only the server knows enough to decide this — whether the address is on the
 * admin allowlist, and whether a profile exists — so the decision lives here
 * rather than in the form.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return NextResponse.redirect(`${origin}/auth`);

  // A moderation account has no reason to have a dating profile.
  if (isAdminEmail(auth.user.email)) {
    return NextResponse.redirect(`${origin}/admin`);
  }

  const admin = createAdminClient();
  if (admin) {
    const { data: profile } = await admin
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (profile?.onboarding_complete) return NextResponse.redirect(`${origin}/explore`);
  }

  return NextResponse.redirect(`${origin}/onboarding`);
}
