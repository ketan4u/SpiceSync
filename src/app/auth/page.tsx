import AppHeader from '../AppHeader.tsx';
import { redirect } from 'next/navigation';
import AuthForm from './AuthForm.tsx';
import { createClient } from '@/lib/supabase/server.ts';

export const metadata = { title: 'Sign in — SpiceSync' };

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  // Only redirect an already-signed-in user when Supabase is actually
  // configured; otherwise this page is the one that explains why it is not.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect(next ?? '/after-signin');
  }

  return (
    <main className="shell">
      <AppHeader />
      <AuthForm
        phoneEnabled={process.env.AUTH_PHONE_ENABLED === 'true'}
        next={next ?? '/after-signin'}
        linkFailed={error === 'link'}
      />
    </main>
  );
}
