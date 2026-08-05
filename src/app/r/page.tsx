import Link from 'next/link';
import type { Metadata } from 'next';

/**
 * The shareable result link.
 *
 * The identity travels in the query string, so a result can be shared before
 * any of it is persisted — no account, no database, no row to write. When
 * profiles land in Phase 1 this becomes a lookup by id; the URL shape and the
 * OG card do not have to change.
 */
type Params = { searchParams: Promise<{ l?: string; e?: string; d?: string }> };

export async function generateMetadata({ searchParams }: Params): Promise<Metadata> {
  const { l = 'Something delicious', e = '🍽️', d = '' } = await searchParams;
  const title = `I'm "${l}" on Fumble`;
  const og = `/api/og?l=${encodeURIComponent(l)}&e=${encodeURIComponent(e)}`;
  return {
    title,
    description: d ? `The dish that gave me away: ${d}. What are you?` : 'What are you?',
    openGraph: { title, images: [{ url: og, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, images: [og] },
  };
}

export default async function SharedResult({ searchParams }: Params) {
  const { l = 'Something delicious', e = '🍽️', d = '' } = await searchParams;
  return (
    <main className="shell">
      <Link href="/" className="wordmark">
        <span aria-hidden>🍴</span> Fumble
      </Link>
      <div className="spacer" />
      <p className="step-label">Their food identity</p>
      <div className="identity">
        <div className="identity-art" aria-hidden>{e}</div>
        <div className="identity-label">{l}</div>
        {d && <div className="identity-dish">The dish that gave them away: {d}</div>}
      </div>
      <p className="lede">Eight taps and you&apos;ll know yours.</p>
      <div className="spacer" />
      <Link href="/quiz" className="btn" style={{ textDecoration: 'none' }}>
        Find your food identity
      </Link>
      <p className="foot">Opening one city at a time.</p>
    </main>
  );
}
