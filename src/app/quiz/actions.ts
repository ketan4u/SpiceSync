'use server';

import { createClient } from '@supabase/supabase-js';
import { isKnownCity } from '../../lib/cities.ts';
import type { QuizChoice, TasteVector } from '../../lib/food/types.ts';

/**
 * Waitlist signup.
 *
 * Runs server-side and uses the ANON key, not the service-role key. That is
 * deliberate: the anon key is still subject to row-level security, so the
 * insert-only policy in 0001_waitlist.sql is genuinely enforced. A service-role
 * key would bypass RLS entirely, and there is no reason to hold that much
 * authority to append one row. Neither key is prefixed NEXT_PUBLIC_, so neither
 * is ever bundled into the browser.
 */

export interface WaitlistPayload {
  email: string;
  city: string;
  dietBand: string;
  declaredCuisines: string[];
  vector: TasteVector;
  label: string;
  representativeDish: string;
  choices: QuizChoice[];
}

export type WaitlistResult =
  | { ok: true; already?: boolean }
  | { ok: false; reason: 'invalid_email' | 'invalid_city' | 'unconfigured' | 'failed' };

// Intentionally permissive. Validating email by regex is a losing game; the only
// real check is whether a message arrives. This just catches typos and junk.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinWaitlist(payload: WaitlistPayload): Promise<WaitlistResult> {
  const email = payload.email.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 320) {
    return { ok: false, reason: 'invalid_email' };
  }

  // Validate against the same list the form offered. Which city a signup came
  // from decides where Fumble opens, so this column has to stay clean.
  if (!isKnownCity(payload.city)) {
    return { ok: false, reason: 'invalid_city' };
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    // The app stays fully usable without a database — the quiz is the product,
    // the waitlist is an attachment. Surfacing this rather than pretending to
    // succeed is what stops a demo silently eating signups.
    console.warn('[waitlist] SUPABASE_URL / SUPABASE_ANON_KEY not set — signup not stored');
    return { ok: false, reason: 'unconfigured' };
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error } = await supabase.from('waitlist').insert({
    email,
    city: payload.city,
    diet_band: payload.dietBand,
    declared_cuisines: payload.declaredCuisines,
    label: payload.label,
    spice: payload.vector.spice,
    richness: payload.vector.richness,
    novelty: payload.vector.novelty,
    sweetness: payload.vector.sweetness,
    cuisine_affinity: payload.vector.cuisine,
    setting_affinity: payload.vector.setting,
    confidence: payload.vector.confidence,
    representative_dish: payload.representativeDish,
    // Cap the trail so a crafted request cannot post an unbounded blob.
    choices: payload.choices.slice(0, 32),
    source: 'quiz',
  });

  if (error) {
    // 23505 = unique violation. Signing up twice is not an error anyone needs
    // to see; they are on the list either way.
    if (error.code === '23505') return { ok: true, already: true };
    console.error('[waitlist] insert failed', error.message);
    return { ok: false, reason: 'failed' };
  }

  return { ok: true };
}
