import Link from 'next/link';
import AppHeader from '../AppHeader.tsx';
import ExploreFeed from './ExploreFeed.tsx';
import RealFeed from './RealFeed.tsx';
import { getAnsweredPsychIds, getFeed, getUndoState } from '@/lib/match/pool.ts';
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
  let feed = null;
  let undo = { hasPass: false, available: false };
  let answeredIds: string[] = [];

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      signedIn = true;
      [feed, undo, answeredIds] = await Promise.all([
        getFeed(auth.user.id),
        getUndoState(auth.user.id),
        getAnsweredPsychIds(auth.user.id),
      ]);
    }
  }

  return (
    <main className="shell shell-with-nav">
      <AppHeader />

      {!signedIn || !feed ? (
        <ExploreFeed />
      ) : !feed.reason ? (
        <RealFeed
          initial={feed.cards}
          undo={undo}
          answeredIds={answeredIds}
          diagnosis={feed.diagnosis}
          widen={feed.widen}
        />
      ) : feed.reason === 'no-profile' ? (
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
      ) : feed.reason === 'no-quiz' ? (
        <>
          <h1>Take the quiz</h1>
          <p className="lede">
            Your profile is set up, but there is no food identity on it yet — and that is half of
            how anyone gets ranked for you.
          </p>
          <div className="spacer" />
          <Link href="/quiz" className="btn" style={{ textDecoration: 'none' }}>
            Find your food identity
          </Link>
        </>
      ) : (
        <>
          <h1>Ranking is not configured</h1>
          <p className="lede">
            This build has no <code>SUPABASE_SERVICE_ROLE_KEY</code>, so the server cannot read
            candidates to rank them. Your profile is fine — this is a setup gap, not a problem
            with your account.
          </p>
          <div className="spacer" />
          <Link href="/quiz" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            Back to the quiz
          </Link>
        </>
      )}
    </main>
  );
}
