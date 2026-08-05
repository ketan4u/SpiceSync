import Link from 'next/link';
import { FOOD_CATALOG } from '@/lib/food/food-catalog.ts';

export default function Home() {
  return (
    <main className="shell">
      <Link href="/" className="wordmark">
        <span aria-hidden>🍴</span> Fumble
      </Link>

      <div className="spacer" />

      <h1>The way to someone&apos;s heart really is through their stomach.</h1>
      <p className="lede">
        Fumble is a dating app for India, built on the one thing nobody here is neutral about.
        Answer eight questions about food and we&apos;ll tell you something true about yourself —
        no sign-up, no email, nothing.
      </p>

      <div className="spacer" />

      <div className="stack">
        <Link href="/quiz" className="btn" style={{ textDecoration: 'none' }}>
          Find your food identity
        </Link>
        <p className="foot">
          About 90 seconds · {FOOD_CATALOG.length} dishes · Opening city by city
        </p>
      </div>
    </main>
  );
}
