import AppHeader from '../AppHeader.tsx';
import QuestionFlow from './QuestionFlow.tsx';
import { createClient } from '@/lib/supabase/server.ts';

export const metadata = {
  title: 'A few questions — SpiceSync',
  description: 'Twelve situations. No right answers.',
};

export default async function QuestionsPage() {
  // Answering with an account has to reach the profile. Without this the twelve
  // were saved to the device only, so someone who came here to improve their
  // matches changed nothing about them until they happened to visit settings.
  let signedIn = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  }

  return (
    <main className="shell">
      <AppHeader />
      <QuestionFlow signedIn={signedIn} />
    </main>
  );
}
