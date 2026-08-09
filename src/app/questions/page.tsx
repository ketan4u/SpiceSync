import Link from 'next/link';
import QuestionFlow from './QuestionFlow.tsx';

export const metadata = {
  title: 'A few questions — SpiceSync',
  description: 'Twelve situations. No right answers.',
};

export default function QuestionsPage() {
  return (
    <main className="shell">
      <Link href="/" className="wordmark">
        <span aria-hidden>🌶️</span> SpiceSync
      </Link>
      <div style={{ height: 26 }} />
      <QuestionFlow />
    </main>
  );
}
