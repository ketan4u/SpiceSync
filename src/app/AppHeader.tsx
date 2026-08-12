import Link from 'next/link';
import { isAdminEmail } from '@/lib/admin/guard.ts';
import { signOut } from './actions.ts';
import { createClient } from '@/lib/supabase/server.ts';

/**
 * The one header, on every page.
 *
 * Signed in you get somewhere to go and a way out; signed out it is just the
 * wordmark and a way in. Each page used to render its own bare wordmark, which
 * meant an account had no navigation at all once onboarding finished.
 *
 * Reading the user here costs a request to Supabase on each render. That is
 * knowingly accepted for now — correctness over a round trip while the app is
 * this small — and is the obvious thing to cache when it starts to matter.
 */
export default async function AppHeader() {
  let email: string | null = null;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? null;
  }

  return (
    <header className="nav">
      <Link href="/" className="wordmark">
        <span aria-hidden>🌶️</span> SpiceSync
      </Link>

      <nav className="nav-links">
        {email ? (
          <>
            {isAdminEmail(email) && <Link href="/admin">Moderation</Link>}
            <Link href="/explore">Explore</Link>
            <Link href="/matches">Matches</Link>
            <Link href="/settings">Settings</Link>
            <form action={signOut}>
              <button type="submit" className="nav-signout">Sign out</button>
            </form>
          </>
        ) : (
          <Link href="/auth">Sign in</Link>
        )}
      </nav>
    </header>
  );
}
