'use client';

import Link from 'next/link';
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
        <Link href={`/matches/${match.id}`} className="match-link">
          <span className="option-title">{match.name}</span>
          {match.foodLabel && <span className="option-sub">{match.foodLabel}</span>}
        </Link>
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
