'use client';

import { useRouter } from 'next/navigation';
import SafetyMenu from '../SafetyMenu.tsx';
import type { MatchSummary } from '@/lib/match/pool.ts';

export default function MatchRow({ match }: { match: MatchSummary }) {
  const router = useRouter();
  return (
    <div className="match-row">
      <div className="match-photo">
        {match.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.photoUrl} alt={match.name} />
        ) : (
          <span aria-hidden>{match.name.charAt(0)}</span>
        )}
      </div>
      <div className="match-body">
        <div className="option-title">{match.name}</div>
        {match.foodLabel && <div className="option-sub">{match.foodLabel}</div>}
        <SafetyMenu
          userId={match.id}
          name={match.name}
          canUnmatch
          onDone={() => router.refresh()}
        />
      </div>
    </div>
  );
}
