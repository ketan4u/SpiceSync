'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  CORE_QUESTIONS,
  coreProgress,
  psychChips,
  scorePsych,
  type PsychQuestion,
} from '@/lib/psych/psych-bank.ts';
import { savePsychAnswer, useHydrated, useStoredPsych } from '@/lib/quiz-storage.ts';
import { recordPsychAnswer } from '../settings/actions.ts';

/**
 * Section 3, the core twelve.
 *
 * Every question is skippable and the whole set can be abandoned at any point —
 * the brief is explicit that this section is optional, and a wall of
 * personality questions between someone and the app is the fastest way to lose
 * them. Answers are scored the moment they are given, so leaving after four
 * still improves matching.
 */
export default function QuestionFlow({ signedIn = false }: { signedIn?: boolean }) {
  const hydrated = useHydrated();
  const answers = useStoredPsych();
  const [index, setIndex] = useState(0);

  if (!hydrated) return <p className="foot">Loading…</p>;

  const answeredIds = answers.map((a) => a.questionId);
  const progress = coreProgress(answeredIds);
  const question: PsychQuestion | undefined = CORE_QUESTIONS[index];

  if (!question) return <Done answers={answers} signedIn={signedIn} />;

  const answer = (optionId: string) => {
    savePsychAnswer({ questionId: question.id, optionId });
    // Written one at a time rather than in a batch at the end, because the whole
    // point of this section being skippable is that leaving after four still
    // counts. Not awaited — the device copy is what the screen reads, and
    // settings can still push it if a write here failed.
    if (signedIn) void recordPsychAnswer(question.id, optionId);
    setIndex((i) => i + 1);
  };

  const previous = answers.find((a) => a.questionId === question.id);

  return (
    <>
      <div className="progress" aria-label={`Question ${index + 1} of ${CORE_QUESTIONS.length}`}>
        {CORE_QUESTIONS.map((q, i) => (
          <span
            key={q.id}
            className="pip"
            data-state={
              answeredIds.includes(q.id) ? 'done' : i === index ? 'current' : 'todo'
            }
          />
        ))}
      </div>

      <p className="step-label">
        {index + 1} of {CORE_QUESTIONS.length}
        {progress.done > 0 ? ` · ${progress.done} answered` : ''}
      </p>

      <h1 className="q-prompt">{question.prompt}</h1>

      <div style={{ marginTop: 20 }}>
        {question.options.map((o) => (
          <button
            key={o.id}
            className="option"
            data-selected={previous?.optionId === o.id}
            onClick={() => answer(o.id)}
          >
            <span className="option-title" style={{ fontWeight: 500 }}>
              {o.label}
            </span>
          </button>
        ))}
      </div>

      <div className="spacer" />

      <button className="btn-text" style={{ margin: '0 auto', display: 'block' }} onClick={() => setIndex((i) => i + 1)}>
        Skip this one
      </button>
      <Link href="/explore" className="btn-text" style={{ margin: '0 auto', display: 'block', textAlign: 'center' }}>
        Finish later
      </Link>
    </>
  );
}

function Done({
  answers,
  signedIn,
}: {
  answers: { questionId: string; optionId: string }[];
  signedIn: boolean;
}) {
  const profile = scorePsych(answers);
  const chips = psychChips(profile, 4);
  const progress = coreProgress(answers.map((a) => a.questionId));

  return (
    <>
      <p className="step-label">Section 3</p>
      <h1>{progress.done === progress.total ? 'That is all twelve.' : `You answered ${progress.done} of ${progress.total}.`}</h1>
      <p className="lede">
        {progress.done >= 6
          ? 'Enough to matter. Your matches now weigh how you handle a disagreement, how fast you like things to move, and what you need space for — not just what you eat.'
          : 'A few more would help. Below six questions there is not much for the matching to hold on to, so scores still lean mostly on food.'}
      </p>

      {chips.length > 0 && (
        <div className="identity" style={{ padding: '22px 20px' }}>
          <p className="step-label" style={{ marginBottom: 12 }}>What that says</p>
          <div className="traits" style={{ marginTop: 0 }}>
            {chips.map((c) => (
              <span key={c} className="chip">{c}</span>
            ))}
          </div>
        </div>
      )}

      <p className="note">
        {signedIn
          ? 'Saved to your profile and already in use. They rank people and explain why — never shown to anyone else as raw answers.'
          : 'These answers stay on your device until you make an account. They are used to rank people and to explain why — never shown to anyone else as raw answers.'}
      </p>

      <div className="stack">
        <Link href="/explore" className="btn" style={{ textDecoration: 'none' }}>
          See your matches
        </Link>
      </div>
    </>
  );
}
