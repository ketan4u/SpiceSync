'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server.ts';

/**
 * Sending a message.
 *
 * Runs as the signed-in user, so the insert policy — which requires a live
 * match, checked by `is_matched_with` in the database — is what actually
 * authorises this. Nothing here re-implements that check, because a second
 * copy of a rule is a second thing to get out of step.
 */
export async function sendMessage(
  recipientId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, error: 'Write something first.' };
  if (trimmed.length > 2000) return { ok: false, error: 'That is too long.' };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('messages')
    .insert({ sender_id: auth.user.id, recipient_id: recipientId, body: trimmed });

  if (error) {
    console.error('[messages] send failed', error.message);
    // The insert policy is the only thing that can reject a well-formed row, so
    // say what that means rather than showing a database error.
    return { ok: false, error: 'Could not send. You may no longer be matched.' };
  }

  revalidatePath(`/matches/${recipientId}`);
  return { ok: true };
}

export async function markThreadRead(otherId: string): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', auth.user.id)
    .eq('sender_id', otherId)
    .is('read_at', null);
}
