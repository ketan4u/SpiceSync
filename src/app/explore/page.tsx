import Link from 'next/link';
import ExploreFeed from './ExploreFeed.tsx';
import RealFeed from './RealFeed.tsx';
import { getFeed } from '@/lib/match/pool.ts';
import { createClient } from '@/lib/supabase/server.ts';

export const metadata = {
  title: 'Explore — SpiceSync',
  description: 'People ranked against your food identity.',
};

/**
 * Signed in and onboarded, you see real people ranked by the server. Otherwise
 * you get the seeded demo, which is what keeps the public quiz meaningful for
 * someone who has not made an account.
 */
export default async function ExplorePage() {
  let signedIn = false;
  let cards = null;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      signedIn = true;
      const feed = await getFeed(auth.user.id);
      // 'no-profile' means they signed in but never finished onboarding;
      // 'unavailable' means no service-role key, so ranking cannot run at all.
      if (!feed.reason) cards = feed.cards;
      else if (feed.reason === 'no-profile') cards = null;
    }
  }

  return (
    <main className="shell">
      <Link href="/" className="wordmark">
        <span aria-hidden>🌶️</span> SpiceSync
      </Link>
      <div style={{ height: 22 }} />

      {signedIn && cards ? (
        <RealFeed initial={cards} />
      ) : signedIn ? (
        <>
          <h1>Finish your profile</h1>
          <p className="lede">
            We need a few details before we can show you anyone — or rank you for them.
          </p>
          <div className="spacer" />
          <Link href="/onboarding" className="btn" style={{ textDecoration: 'none' }}>
            Finish setting up
          </Link>
        </>
      ) : (
        <ExploreFeed />
      )}
    </main>
  );
}
