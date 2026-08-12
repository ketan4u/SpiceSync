import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppHeader from '../AppHeader.tsx';
import SettingsForm from './SettingsForm.tsx';
import { getBlocked, getEditableProfile } from './data.ts';
import { createClient } from '@/lib/supabase/server.ts';

export const metadata = { title: 'Settings — SpiceSync' };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/auth?next=/settings');

  const profile = await getEditableProfile(auth.user.id);
  const blocked = await getBlocked(auth.user.id);

  return (
    <main className="shell">
      <AppHeader />
      <h1>Settings</h1>

      {profile ? (
        <SettingsForm profile={profile} blocked={blocked} email={auth.user.email ?? ''} />
      ) : (
        <>
          <p className="lede">You have not finished setting up your profile yet.</p>
          <div className="spacer" />
          <Link href="/onboarding" className="btn" style={{ textDecoration: 'none' }}>
            Finish setting up
          </Link>
        </>
      )}
    </main>
  );
}
