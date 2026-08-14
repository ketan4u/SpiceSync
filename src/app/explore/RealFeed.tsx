'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FeedCard } from '@/lib/match/pool.ts';
import {
  coreProgress,
  nextQuestion,
  type PsychQuestion,
} from '@/lib/psych/psych-bank.ts';
import SafetyMenu from '../SafetyMenu.tsx';
import { loadMore, recordPsychAnswer, recordVerdict, undoLastPass } from './actions.ts';

/**
 * Explore, over real accounts.
 *
 * The cards arrive already ranked and already projected — the server does the
 * scoring, and nothing in this component has access to anyone's psych answers
 * or date of birth. It renders what it is given and reports verdicts back.
 */
export default function RealFeed({
  initial,
  undo,
  answeredIds,
}: {
  initial: FeedCard[];
  undo: { hasPass: boolean; available: boolean };
  /** Section 3 questions already on this person's profile. */
  answeredIds: string[];
}) {
  const [cards, setCards] = useState(initial);
  const [undoState, setUndoState] = useState(undo);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [matched, setMatched] = useState<FeedCard | null>(null);
  const [pending, setPending] = useState(false);
  const [answered, setAnswered] = useState(answeredIds);
  const [drip, setDrip] = useState<PsychQuestion | null>(null);
  const [decided, setDecided] = useState(0);

  const current = cards[index];
  const progress = coreProgress(answered);

  const decide = async (verdict: 'like' | 'pass') => {
    if (!current || pending) return;
    setPending(true);
    const result = await recordVerdict(current.id, verdict);
    setPending(false);
    if (result.matched) {
      setMatched(current);
      return;
    }
    if (verdict === 'pass') setUndoState((u) => ({ ...u, hasPass: true }));
    setIndex((i) => i + 1);

    // Every fourth card, ask one question — the brief's "prompts shown while
    // swiping". Frequent enough to build a profile, rare enough not to feel like
    // a form. Half of every score is psychological, so someone who skipped
    // Section 3 at signup is being ranked on a neutral 0.5 until these land.
    const count = decided + 1;
    setDecided(count);
    if (count % 4 === 0) setDrip(nextQuestion(answered));
  };

  /**
   * Answers the question on screen, then rebuilds the deck.
   *
   * The answer changes the psychological half of every score, so the cards below
   * were ranked without it. Reloading is what makes answering worth doing —
   * otherwise the feed keeps showing an order the app no longer believes in.
   * Restarting at index 0 is correct because everyone already judged is excluded
   * server-side, so a fresh deck resumes exactly where this one stopped.
   */
  const answerDrip = async (optionId: string) => {
    if (!drip || pending) return;
    setPending(true);
    const result = await recordPsychAnswer(drip.id, optionId);
    if (result.ok) {
      setAnswered(result.answeredIds);
      setCards(await loadMore());
      setIndex(0);
    }
    setDrip(null);
    setPending(false);
  };

  /**
   * Brings back the last person passed, and shows them next.
   *
   * The feed is reloaded rather than refreshed, and the restored person is put
   * at the front by hand. Left to the ranking they could reappear anywhere in
   * the list, which is not what someone means when they undo a mis-tap.
   */
  const runUndo = async () => {
    if (pending) return;
    setPending(true);
    setUndoError(null);
    const result = await undoLastPass();
    if (!result.ok) {
      setUndoError(result.error);
      setUndoState((u) => ({ ...u, available: false }));
      setPending(false);
      return;
    }
    const fresh = await loadMore();
    const restored = fresh.find((c) => c.id === result.restoredId);
    setCards(restored ? [restored, ...fresh.filter((c) => c.id !== restored.id)] : fresh);
    setIndex(0);
    setUndoState({ hasPass: false, available: false });
    setPending(false);
  };

  if (matched) {
    return (
      <div className="empty">
        <div className="empty-art" aria-hidden>🌶️</div>
        <h2>You matched with {matched.name}</h2>
        <p>You both said yes. That is the whole idea.</p>
        <div className="stack">
          <Link href="/matches" className="btn" style={{ textDecoration: 'none' }}>
            See your matches
          </Link>
          <button className="btn btn-ghost" onClick={() => { setMatched(null); setIndex((i) => i + 1); }}>
            Keep looking
          </button>
        </div>
      </div>
    );
  }

  // Ahead of the empty state on purpose: when the fourth verdict was also the
  // last card, the question is still worth asking rather than dropped.
  if (drip) {
    return (
      <div className="drip">
        <p className="drip-label">One quick question</p>
        <h2>{drip.prompt}</h2>
        {drip.options.map((o) => (
          <button
            key={o.id}
            className="option"
            disabled={pending}
            onClick={() => answerDrip(o.id)}
          >
            <span className="option-title" style={{ fontWeight: 500 }}>{o.label}</span>
          </button>
        ))}
        <button
          className="btn-text"
          style={{ margin: '2px auto 0', display: 'block' }}
          disabled={pending}
          onClick={() => setDrip(null)}
        >
          Skip
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="empty">
        <div className="empty-art" aria-hidden>🍽️</div>
        <h2>{cards.length === 0 ? 'Nobody here yet' : 'That is everyone for now'}</h2>
        <p>
          {cards.length === 0
            ? 'You are early. As people join your city they will show up here, ranked against your food identity.'
            : 'You have seen everyone who matches right now. New people appear as they join.'}
        </p>
        <Link href="/matches" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          See your matches
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="feed-head">
        <span className="feed-count">{index + 1} of {cards.length}</span>
        <Link href="/matches" className="feed-mine">Matches</Link>
      </div>

      <article className="card">
        {current.banner && (
          <div className="card-banner">
            We think you&apos;ll be a great match — you should try to meet.
          </div>
        )}

        <div className="card-photos">
          <div className="card-portrait">
            {current.photoUrl ? (
              /* Signed URLs expire after 30 minutes, so next/image would cache
                 and then serve a link that has already died. */
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.photoUrl} alt={current.name} />
            ) : (
              <span aria-hidden>{current.name.charAt(0)}</span>
            )}
          </div>
          <div className="card-dish">
            {current.dishPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.dishPhotoUrl} alt="" />
            ) : (
              <span aria-hidden>🍽️</span>
            )}
          </div>
        </div>

        <div className="card-body">
          <div className="card-top">
            <h2 className="card-name">{current.name}, {current.age}</h2>
            {current.showScore && (
              <span className={`card-score${current.displayScore >= 85 ? ' high' : ''}`}>
                {current.displayScore}%
              </span>
            )}
          </div>
          {current.foodLabel && <p className="card-identity">{current.foodLabel}</p>}
          <p className="card-meta">
            {current.city}
            {current.representativeDish ? ` · ${current.representativeDish} person` : ''}
          </p>
          {current.chips.length > 0 ? (
            <div className="card-chips">
              {current.chips.map((c) => <span key={c} className="chip">{c}</span>)}
            </div>
          ) : (
            <p className="card-nothing">Nothing obvious in common yet.</p>
          )}
        </div>
      </article>

      <div className="verdicts">
        <button className="verdict pass" onClick={() => decide('pass')} disabled={pending}>
          Pass
        </button>
        <button className="verdict like" onClick={() => decide('like')} disabled={pending}>
          Like
        </button>
      </div>

      {undoState.hasPass && undoState.available && (
        <button className="safety-trigger" onClick={runUndo} disabled={pending}>
          Bring back the last person I passed
        </button>
      )}
      {undoError && <p className="foot">{undoError}</p>}

      {progress.done === 0 ? (
        <p className="foot">
          Half of every score is psychological compatibility, and you have not answered those
          questions yet — so these are food and intent only. One question appears every few
          cards.
        </p>
      ) : progress.done < progress.total ? (
        <p className="foot">
          {progress.done} of {progress.total} personality questions answered. The rest arrive as
          you swipe, and each one sharpens these scores.
        </p>
      ) : (
        <p className="foot">All twelve answered — these scores use everything we have.</p>
      )}

      <SafetyMenu
        key={current.id}
        userId={current.id}
        name={current.name}
        onDone={() => setIndex((i) => i + 1)}
      />
    </>
  );
}
