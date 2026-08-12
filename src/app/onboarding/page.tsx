import AppHeader from '../AppHeader.tsx';
import { redirect } from 'next/navigation';
import OnboardingFlow from './OnboardingFlow.tsx';
import { createClient } from '@/lib/supabase/server.ts';

export const metadata = { title: 'Set up your profile — SpiceSync' };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  // Middleware already redirects signed-out visitors; this is the backstop for
  // any path that skips it.
  if (!auth.user) redirect('/auth?next=/onboarding');

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profile?.onboarding_complete) redirect('/explore');

  return (
    <main className="shell">
      <AppHeader />
      <OnboardingFlow userId={auth.user.id} />
    </main>
  );
}
