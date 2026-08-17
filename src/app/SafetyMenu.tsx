'use client';

import { useState, useTransition } from 'react';
import { REPORT_REASONS, type ReportReason } from '@/lib/safety-reasons.ts';
import { blockUser, reportUser, unmatch } from './safety.ts';

/**
 * Block, report, unmatch.
 *
 * Deliberately understated in the feed and plainly available on a match — it
 * should never be hard to find, and never be the loudest thing on the card.
 *
 * Reporting blocks as a side effect, and the copy says so before the tap rather
 * than after: someone reporting harassment should not have to take a second
 * action to stop seeing the person.
 */
type Mode = 'closed' | 'menu' | 'report';

export default function SafetyMenu({
  userId,
  name,
  canUnmatch = false,
  onDone,
}: {
  userId: string;
  name: string;
  canUnmatch?: boolean;
  onDone?: () => void;
}) {
  const [mode, setMode] = useState<Mode>('closed');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, message: string) => {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? 'Something went wrong.');
        return;
      }
      setDone(message);
      setMode('closed');
      onDone?.();
    });
  };

  if (done) return <p className="safety-done">{done}</p>;

  if (mode === 'closed') {
    return (
      <button className="safety-trigger" onClick={() => setMode('menu')}>
        Block or report
      </button>
    );
  }

  if (mode === 'report') {
    return (
      <div className="safety-panel">
        <p className="drip-label">Report {name}</p>
        {REPORT_REASONS.map((r) => (
          <button
            key={r.id}
            className="option"
            data-selected={reason === r.id}
            onClick={() => setReason(r.id)}
          >
            <span className="option-title" style={{ fontWeight: 500 }}>{r.label}</span>
          </button>
        ))}
        <textarea
          className="text-input"
          rows={3}
          maxLength={2000}
          placeholder="Anything else we should know (optional)"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          aria-label="Report details"
        />
        <p className="consent">
          Reporting also blocks {name}. You will not see each other again, and they are not told
          you reported them.
        </p>
        {error && <p className="err">{error}</p>}
        <button
          className="btn"
          disabled={pending || !reason}
          onClick={() => run(() => reportUser(userId, reason!, detail), 'Reported and blocked. Thank you.')}
        >
          {pending ? 'Sending…' : 'Send report'}
        </button>
        <button className="btn-text" style={{ margin: '0 auto', display: 'block' }} onClick={() => setMode('menu')}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="safety-panel">
      {canUnmatch && (
        <button
          className="option"
          disabled={pending}
          onClick={() => run(() => unmatch(userId), `You are no longer matched with ${name}.`)}
        >
          <span>
            <span className="option-title">Unmatch</span>
            <span className="option-sub">Ends the match. They are not notified.</span>
          </span>
        </button>
      )}
      <button
        className="option"
        disabled={pending}
        onClick={() => run(() => blockUser(userId), `${name} is blocked.`)}
      >
        <span>
          <span className="option-title">Block {name}</span>
          <span className="option-sub">Neither of you will see the other again. You can undo this in settings.</span>
        </span>
      </button>
      <button className="option" onClick={() => setMode('report')}>
        <span>
          <span className="option-title">Report {name}</span>
          <span className="option-sub">Blocks them too, and sends it to us to review.</span>
        </span>
      </button>
      {error && <p className="err">{error}</p>}
      <button className="btn-text" style={{ margin: '0 auto', display: 'block' }} onClick={() => setMode('closed')}>
        Cancel
      </button>
    </div>
  );
}
