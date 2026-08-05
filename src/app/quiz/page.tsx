import Link from 'next/link';
import QuizFlow from './QuizFlow.tsx';

export const metadata = {
  title: 'What is your food identity? — Fumble',
  description: 'Eight taps. No sign-up. Find out how you actually eat.',
};

export default function QuizPage() {
  return (
    <main className="shell">
      <Link href="/" className="wordmark">
        <span aria-hidden>🍴</span> Fumble
      </Link>
      <div style={{ height: 28 }} />
      <QuizFlow />
    </main>
  );
}
