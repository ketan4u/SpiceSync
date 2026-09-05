import Link from 'next/link';
import { FOOD_CATALOG } from '@/lib/food/food-catalog.ts';

export default function Home() {
  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--splash-bg)', maxWidth: 560, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '20px' }}>
        <div style={{ width: 110, height: 110, borderRadius: '55px', background: 'var(--logo-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>
          🔥
        </div>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-display), ui-serif, serif', fontSize: 'clamp(36px, 10vw, 48px)', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            SpiceSync
          </span>
          <span style={{ fontSize: 16, color: '#F7E6D8' }}>
            Find love through flavor
          </span>
        </div>
      </div>

      {/* Bottom */}
      <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ borderRadius: 24, background: 'rgba(0,0,0,0.25)', padding: '28px 20px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#ffffff', lineHeight: 1.6 }}>
            A psychological compatibility layer, cooked up for food lovers.
            Answer {FOOD_CATALOG.length} food questions. No sign-up required.
          </p>
        </div>

        <Link href="/quiz" className="btn" style={{ textDecoration: 'none', borderRadius: 16, fontSize: 16, fontWeight: 600, background: 'var(--logo-accent)' }}>
          Get Started
        </Link>

        <p style={{ margin: 0, textAlign: 'center', fontSize: 12, color: 'rgba(247,230,216,0.55)' }}>
          About 90 seconds · {FOOD_CATALOG.length} dishes · Opening city by city
        </p>
      </div>
    </main>
  );
}
