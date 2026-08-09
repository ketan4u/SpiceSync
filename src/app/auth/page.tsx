import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthForm from './AuthForm.tsx';
import { createClient } from '@/lib/supabase/server.ts';

export const metadata = { title: 'Sign in — SpiceSync' };

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only redirect an already-signed-in user when Supabase is actually
  // configured; otherwise this page is the one that explains why it is not.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect(next ?? '/onboarding');
  }

  return (
    <main className="shell">
      <Link href="/" className="wordmark">
        <span aria-hidden>🌶️</span> SpiceSync
      </Link>
      <div style={{ height: 26 }} />
      <AuthForm
        phoneEnabled={process.env.AUTH_PHONE_ENABLED === 'true'}
        next={next ?? '/onboarding'}
      />
    </main>
  );
}
