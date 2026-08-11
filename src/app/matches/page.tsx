import Link from 'next/link';
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
      <Link href="/" className="wordmark">
        <span aria-hidden>🌶️</span> SpiceSync
      </Link>
      <div style={{ height: 26 }} />
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
              <div key={m.id} className="match-row">
                <div className="match-photo">
                  {m.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photoUrl} alt={m.name} />
                  ) : (
                    <span aria-hidden>{m.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <div className="option-title">{m.name}</div>
                  {m.foodLabel && <div className="option-sub">{m.foodLabel}</div>}
                </div>
              </div>
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
