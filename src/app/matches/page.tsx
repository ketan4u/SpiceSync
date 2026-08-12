import Link from 'next/link';
import AppHeader from '../AppHeader.tsx';
import MatchRow from './MatchRow.tsx';
import { redirect } from 'next/navigation';
import { getMatches } from '@/lib/match/pool.ts';
import { createClient } from '@/lib/supabase/server.ts';

export const metadata = { title: 'Matches — SpiceSync' };

export default async function MatchesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/auth?next=/matches');

  const matches = await getMatches(auth.user.id);

  return (
    <main className="shell">
      <AppHeader />
      <h1>Matches</h1>

      {matches.length === 0 ? (
        <>
          <p className="lede">
            Nobody yet. A match happens when you both say yes — until then, neither of you knows
            the other looked.
          </p>
          <div className="spacer" />
          <Link href="/explore" className="btn" style={{ textDecoration: 'none' }}>
            Back to Explore
          </Link>
        </>
      ) : (
        <>
          <p className="lede">{matches.length} {matches.length === 1 ? 'person' : 'people'} said yes back.</p>
          <div className="match-list">
            {matches.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
          <p className="note">
            Messaging is not built yet. This is where a conversation will start.
          </p>
        </>
      )}
    </main>
  );
}
