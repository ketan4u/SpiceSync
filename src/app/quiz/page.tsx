import AppHeader from '../AppHeader.tsx';
import QuizFlow from './QuizFlow.tsx';

export const metadata = {
  title: 'What is your food identity? — SpiceSync',
  description: 'Eight taps. No sign-up. Find out how you actually eat.',
};

export default function QuizPage() {
  return (
    <main className="shell">
      <AppHeader />
      <QuizFlow />
    </main>
  );
}
