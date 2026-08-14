'use server';

import { createClient } from '../../lib/supabase/server.ts';
import { getFeed, type FeedCard } from '../../lib/match/pool.ts';
import {
  mergePsychAnswers,
  sanitisePsychAnswers,
} from '../../lib/psych/psych-bank.ts';

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

/**
 * Undoes the most recent pass.
 *
 * The daily allowance and the deletion happen inside one Postgres function, so
 * two taps in flight cannot both succeed and nobody can spend an undo on a
 * pass that turns out not to exist. Nothing here re-checks the limit — a second
 * copy of that rule is a second thing to drift.
 */
export async function undoLastPass(): Promise<
  { ok: true; restoredId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase.rpc('undo_last_pass');
  if (error) {
    console.error('[explore] undo failed', error.message);
    if (error.message.includes('duplicate key')) {
      return { ok: false, error: 'You have already used your undo today. It resets at midnight.' };
    }
    if (error.message.includes('nothing to undo')) {
      return { ok: false, error: 'There is nobody to bring back yet.' };
    }
    if (error.message.includes('does not exist')) {
      return { ok: false, error: 'Undo is not set up — apply supabase/migrations.' };
    }
    return { ok: false, error: 'Could not undo. Try again.' };
  }

  return { ok: true, restoredId: data as string };
}

/**
 * Records one drip question, answered between cards in the feed.
 *
 * The brief asks for Section 3 to be fillable "through prompts shown while
 * swiping", and until now only the signed-out demo did that — it wrote to
 * localStorage, which a signed-in person's matching never reads. So this writes
 * to the profile, through the ordinary client, so RLS is what decides whose row
 * is touched.
 *
 * Read-modify-write, which is safe because there is only ever one question on
 * screen and the feed blocks while this is in flight. The alternative — a jsonb
 * append in SQL — cannot drop a previous answer to the same question, and
 * re-answering has to be possible.
 */
export async function recordPsychAnswer(
  questionId: string,
  optionId: string,
): Promise<{ ok: boolean; answeredIds: string[] }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, answeredIds: [] };

  // A server action is a public endpoint, so the question and the option are
  // checked against the bank rather than trusted.
  const incoming = sanitisePsychAnswers([{ questionId, optionId }]);
  if (incoming.length === 0) return { ok: false, answeredIds: [] };

  const { data: row, error: readError } = await supabase
    .from('profiles')
    .select('psych_answers')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (readError || !row) return { ok: false, answeredIds: [] };

  const existing = sanitisePsychAnswers(row.psych_answers);
  const merged = mergePsychAnswers(existing, incoming);

  const { error } = await supabase
    .from('profiles')
    .update({ psych_answers: merged })
    .eq('id', auth.user.id);
  if (error) {
    console.error('[explore] psych answer failed', error.message);
    return { ok: false, answeredIds: existing.map((a) => a.questionId) };
  }

  return { ok: true, answeredIds: merged.map((a) => a.questionId) };
}

export async function loadMore(): Promise<FeedCard[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const feed = await getFeed(auth.user.id);
  return feed.cards;
}
