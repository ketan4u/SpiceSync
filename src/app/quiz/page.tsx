import AppHeader from '../AppHeader.tsx';
import QuizFlow from './QuizFlow.tsx';
import { createClient } from '@/lib/supabase/server.ts';

export const metadata = {
  title: 'What is your food identity? — SpiceSync',
  description: 'Eight taps. No sign-up. Find out how you actually eat.',
};

export default async function QuizPage() {
  // Someone retaking the quiz with an account needs their result saved, not a
  // waitlist form asking for the email they already signed in with.
  let signedIn = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  }

  return (
    <main className="shell">
      <AppHeader />
      <QuizFlow signedIn={signedIn} />
    </main>
  );
}
