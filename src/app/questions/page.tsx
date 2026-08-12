import AppHeader from '../AppHeader.tsx';
import QuestionFlow from './QuestionFlow.tsx';

export const metadata = {
  title: 'A few questions — SpiceSync',
  description: 'Twelve situations. No right answers.',
};

export default function QuestionsPage() {
  return (
    <main className="shell">
      <AppHeader />
      <QuestionFlow />
    </main>
  );
}
