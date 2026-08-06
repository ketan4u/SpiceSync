import Link from 'next/link';
import QuizFlow from './QuizFlow.tsx';

export const metadata = {
  title: 'What is your food identity? — SpiceSync',
  description: 'Eight taps. No sign-up. Find out how you actually eat.',
};

export default function QuizPage() {
  return (
    <main className="shell">
      <Link href="/" className="wordmark">
        <span aria-hidden>🌶️</span> SpiceSync
      </Link>
      <div style={{ height: 28 }} />
      <QuizFlow />
    </main>
  );
}
