import Link from 'next/link';
import ExploreFeed from './ExploreFeed.tsx';

export const metadata = {
  title: 'Explore — SpiceSync',
  description: 'People ranked against your food identity.',
};

export default function ExplorePage() {
  return (
    <main className="shell">
      <Link href="/" className="wordmark">
        <span aria-hidden>🌶️</span> SpiceSync
      </Link>
      <div style={{ height: 22 }} />
      <ExploreFeed />
    </main>
  );
}
