'use server';

import { createClient } from '../../lib/supabase/server.ts';
import { getFeed, type FeedCard } from '../../lib/match/pool.ts';

/**
 * Records a like or a pass.
 *
 * The verdict is written as the signed-in user through the ordinary client, so
 * RLS enforces that nobody can record a verdict on someone else's behalf — the
 * admin client is deliberately not used here.
 */
export async function recordVerdict(
  likedId: string,
  verdict: 'like' | 'pass',
): Promise<{ ok: boolean; matched?: boolean }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  if (likedId === auth.user.id) return { ok: false };

  const { error } = await supabase
    .from('likes')
    .upsert(
      { liker_id: auth.user.id, liked_id: likedId, verdict },
      { onConflict: 'liker_id,liked_id' },
    );
  if (error) {
    console.error('[explore] verdict failed', error.message);
    return { ok: false };
  }

  if (verdict !== 'like') return { ok: true, matched: false };

  // Whether they liked you back is not readable by you directly — the RLS
  // policy deliberately hides the other side of a pending like. Reciprocity is
  // resolved here, and only ever surfaces once it is mutual.
  const { getMatches } = await import('../../lib/match/pool.ts');
  const matches = await getMatches(auth.user.id);
  return { ok: true, matched: matches.some((m) => m.id === likedId) };
}

export async function loadMore(): Promise<FeedCard[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const feed = await getFeed(auth.user.id);
  return feed.cards;
}
