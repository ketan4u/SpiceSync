'use server';

import { createClient } from '../lib/supabase/server.ts';
import type { ReportReason } from '../lib/safety-reasons.ts';

/**
 * Blocking, reporting, unmatching.
 *
 * All three run as the signed-in user through the ordinary client, so RLS
 * proves nobody can act on someone else's behalf. None of them touch the
 * service-role client — there is no reason for these to bypass anything.
 */

type Result = { ok: boolean; error?: string };

/**
 * Blocking records a block, and nothing else.
 *
 * An earlier version also wrote a `pass`, on the reasoning that a second record
 * made the intent survive any future change to how the pool is filtered. It did
 * the opposite of what was wanted: the upsert OVERWROTE the blocker's existing
 * verdict, so blocking somebody you had liked destroyed the like, and
 * unblocking could not bring it back. A match ended permanently on an action
 * the product describes as reversible.
 *
 * The `blocks` table already hides both people from each other, in both
 * directions, in the feed and in matches — see `blockedEitherWay` in pool.ts.
 * That is sufficient, and it is non-destructive.
 */
export async function blockUser(blockedId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Not signed in.' };
  if (auth.user.id === blockedId) return { ok: false, error: 'You cannot block yourself.' };

  const { error } = await supabase
    .from('blocks')
    .upsert({ blocker_id: auth.user.id, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });
  if (error) {
    console.error('[safety] block failed', error.message);
    return { ok: false, error: 'Could not block. Try again.' };
  }

  return { ok: true };
}

export async function unblockUser(blockedId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', auth.user.id)
    .eq('blocked_id', blockedId);
  if (error) {
    console.error('[safety] unblock failed', error.message);
    return { ok: false, error: 'Could not unblock.' };
  }
  // Whatever verdict existed before the block is still there, untouched, so
  // unblocking restores the prior state — including a match, if there was one.
  return { ok: true };
}

/** Reporting always blocks too — nobody reports someone they want to keep seeing. */
export async function reportUser(
  reportedId: string,
  reason: ReportReason,
  detail?: string,
): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Not signed in.' };
  if (auth.user.id === reportedId) return { ok: false, error: 'You cannot report yourself.' };

  const { error } = await supabase.from('reports').insert({
    reporter_id: auth.user.id,
    reported_id: reportedId,
    reason,
    detail: detail?.slice(0, 2000) || null,
  });
  if (error) {
    console.error('[safety] report failed', error.message);
    return { ok: false, error: 'Could not send the report. Try again.' };
  }

  await blockUser(reportedId);
  return { ok: true };
}

/**
 * Unmatching flips your like to a pass, which breaks the reciprocity the match
 * was derived from. The row is updated rather than deleted so the pool still
 * treats this person as judged and does not offer them again.
 */
export async function unmatch(otherId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('likes')
    .upsert(
      { liker_id: auth.user.id, liked_id: otherId, verdict: 'pass' },
      { onConflict: 'liker_id,liked_id' },
    );
  if (error) {
    console.error('[safety] unmatch failed', error.message);
    return { ok: false, error: 'Could not unmatch. Try again.' };
  }
  return { ok: true };
}
