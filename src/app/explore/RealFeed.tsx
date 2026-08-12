'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FeedCard } from '@/lib/match/pool.ts';
import SafetyMenu from '../SafetyMenu.tsx';
import { recordVerdict } from './actions.ts';

/**
 * Explore, over real accounts.
 *
 * The cards arrive already ranked and already projected — the server does the
 * scoring, and nothing in this component has access to anyone's psych answers
 * or date of birth. It renders what it is given and reports verdicts back.
 */
export default function RealFeed({ initial }: { initial: FeedCard[] }) {
  const [cards] = useState(initial);
  const [index, setIndex] = useState(0);
  const [matched, setMatched] = useState<FeedCard | null>(null);
  const [pending, setPending] = useState(false);

  const current = cards[index];

  const decide = async (verdict: 'like' | 'pass') => {
    if (!current || pending) return;
    setPending(true);
    const result = await recordVerdict(current.id, verdict);
    setPending(false);
    if (result.matched) {
      setMatched(current);
      return;
    }
    setIndex((i) => i + 1);
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

      <SafetyMenu
        key={current.id}
        userId={current.id}
        name={current.name}
        onDone={() => setIndex((i) => i + 1)}
      />
    </>
  );
}
