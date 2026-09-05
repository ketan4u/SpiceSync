import 'server-only';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin.ts';
import { createClient } from '@/lib/supabase/server.ts';
import BottomNav from '../../BottomNav.tsx';

export const metadata = { title: 'Profile — SpiceSync' };

export default async function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // Use admin client — profiles have no cross-user read policy
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, name, date_of_birth, city, food_label, representative_dish, taste, photo_paths, gender')
    .eq('id', id)
    .eq('onboarding_complete', true)
    .single();

  if (error || !profile) notFound();

  const age = Math.floor(
    (Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)
  );

  const taste = profile.taste as { spice: number; richness: number; novelty: number; sweetness: number } | null;
  const AXES = [
    { key: 'spice' as const,    low: 'Mild',       high: 'Extra spicy' },
    { key: 'richness' as const, low: 'Light',      high: 'Rich' },
    { key: 'novelty' as const,  low: 'Your usual', high: 'Anything new' },
    { key: 'sweetness' as const,low: 'Savoury',    high: 'Sweet tooth' },
  ];

  return (
    <main className="shell shell-with-nav" style={{ paddingBottom: 100 }}>
      <BottomNav />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link href="/explore" style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, textDecoration: 'none', flexShrink: 0 }}>
          ‹
        </Link>
        <h2 style={{ flex: 1, textAlign: 'center', margin: 0 }}>Profile</h2>
        <div style={{ width: 36 }} />
      </div>

      {/* Portrait */}
      <div style={{ width: 80, height: 80, borderRadius: 40, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 8px', fontWeight: 700, color: 'var(--accent)' }}>
        {profile.name.charAt(0)}
      </div>
      <h1 style={{ textAlign: 'center', marginBottom: 4 }}>
        {profile.name}, {age}
      </h1>
      <p style={{ textAlign: 'center', color: 'var(--ink-soft)', marginBottom: 24 }}>
        {profile.city}
      </p>

      {/* Identity card */}
      {profile.food_label && (
        <div className="identity" style={{ marginBottom: 24 }}>
          <div className="identity-art" aria-hidden>🌶️</div>
          <div className="identity-label">{profile.food_label}</div>
          {profile.representative_dish && (
            <div className="identity-dish">{profile.representative_dish}</div>
          )}
        </div>
      )}

      {/* Taste bars */}
      {taste && (
        <div className="bars" style={{ marginBottom: 24 }}>
          {AXES.map(({ key, low, high }) => (
            <div className="bar-row" key={key}>
              <span>{low}</span>
              <span className="bar">
                <span className="bar-fill" style={{ width: `${taste[key] * 100}%` }} />
                <span className="bar-dot" style={{ left: `${taste[key] * 100}%` }} />
              </span>
              <span className="r">{high}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sticky Like button */}
      <div style={{ position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 560, padding: '12px 20px', background: 'var(--bg)', borderTop: '1px solid var(--line)' }}>
        <Link
          href={`/explore`}
          className="btn"
          style={{ textDecoration: 'none', borderRadius: 16 }}
        >
          ♥  Like {profile.name}
        </Link>
      </div>
    </main>
  );
}
