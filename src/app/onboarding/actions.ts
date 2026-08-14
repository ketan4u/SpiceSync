'use server';

import { isKnownCity } from '../../lib/cities.ts';
import { sanitiseTags } from '../../lib/dealbreakers.ts';
import { INTENTS, type Intent } from '../../lib/match/types.ts';
import { createClient } from '../../lib/supabase/server.ts';
import { sanitisePsychAnswers, type PsychAnswer } from '../../lib/psych/psych-bank.ts';
import type { TasteVector } from '../../lib/food/types.ts';
import { sanitiseFoodAnswers, type FoodAnswer } from '../../lib/food/food-relationship.ts';

/**
 * Completes a profile.
 *
 * Everything the client sends is re-checked here. The browser holds a public
 * anon key and talks to Supabase directly, so client-side validation is a
 * convenience for the user and nothing more — this function and the RLS
 * policies are the only things that actually hold.
 */

export interface OnboardingPayload {
  name: string;
  dateOfBirth: string; // yyyy-mm-dd
  gender: string;
  seeking: string[];
  intents: string[];
  city: string;
  openToDistance: boolean;
  photoPaths: string[];
  attributes?: string[];
  nonNegotiables?: string[];
  // Carried from the device, taken before the account existed.
  dietBand?: string;
  declaredCuisines?: string[];
  taste?: TasteVector;
  foodLabel?: string;
  representativeDish?: string;
  psychAnswers?: PsychAnswer[];
  foodAnswers?: FoodAnswer[];
}

export type OnboardingResult =
  | { ok: true }
  | { ok: false; reason: string };

const GENDERS = ['woman', 'man', 'non-binary'];

/** Whole years, computed the same way a person would. */
function ageOn(dob: string, on = new Date()): number {
  const birth = new Date(`${dob}T00:00:00Z`);
  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = on.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

export async function completeOnboarding(payload: OnboardingPayload): Promise<OnboardingResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, reason: 'You are not signed in.' };

  const name = payload.name.trim();
  if (name.length < 1 || name.length > 60) return { ok: false, reason: 'Add a name.' };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.dateOfBirth)) {
    return { ok: false, reason: 'That date of birth is not valid.' };
  }
  const age = ageOn(payload.dateOfBirth);
  // Checked here AND enforced by a trigger in the database. Under the DPDP Act a
  // minor's data carries obligations this product is not equipped to meet, so
  // the rule lives in the layer no client can skip as well as in this one.
  if (age < 18) return { ok: false, reason: 'You must be 18 or older to use SpiceSync.' };
  if (age > 120) return { ok: false, reason: 'That date of birth is not valid.' };

  if (!GENDERS.includes(payload.gender)) return { ok: false, reason: 'Choose a gender.' };

  const seeking = payload.seeking.filter((g) => GENDERS.includes(g));
  // The scorer fails closed on an empty `seeking`, so a profile saved without
  // one would match nobody while looking complete to its owner.
  if (seeking.length === 0) return { ok: false, reason: 'Choose who you want to see.' };

  const intents = payload.intents.filter((i): i is Intent => INTENTS.includes(i as Intent));
  if (intents.length === 0) return { ok: false, reason: 'Choose what you are here for.' };
  // The brief makes "exploring" exclusive. Enforced server-side too, or a
  // crafted request could store a contradiction the UI cannot represent.
  if (intents.includes('exploring') && intents.length > 1) {
    return { ok: false, reason: 'Exploring cannot be combined with anything else.' };
  }

  if (!isKnownCity(payload.city)) return { ok: false, reason: 'Choose your city.' };

  // Paths must sit inside this user's own folder — the same rule storage RLS
  // enforces, repeated so a bad path never reaches the row at all.
  const photoPaths = (payload.photoPaths ?? []).filter((p) =>
    p.startsWith(`${auth.user.id}/`),
  );

  const { error } = await supabase.from('profiles').upsert(
    {
      id: auth.user.id,
      name,
      date_of_birth: payload.dateOfBirth,
      gender: payload.gender,
      seeking,
      intents,
      city: payload.city,
      open_to_distance: Boolean(payload.openToDistance),
      photo_paths: photoPaths,
      // Anything outside the known vocabulary is dropped rather than stored —
      // an unrecognised tag would sit in the gate doing nothing, invisibly.
      attributes: sanitiseTags(payload.attributes),
      non_negotiables: sanitiseTags(payload.nonNegotiables),
      diet_band: payload.dietBand ?? null,
      declared_cuisines: payload.declaredCuisines ?? [],
      taste: payload.taste ?? null,
      food_label: payload.foodLabel ?? null,
      representative_dish: payload.representativeDish ?? null,
      psych_answers: sanitisePsychAnswers(payload.psychAnswers),
      food_answers: sanitiseFoodAnswers(payload.foodAnswers),
      food_archetype: payload.taste?.archetype ?? null,
      food_weight: payload.taste?.foodWeight ?? null,
      onboarding_complete: true,
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.error('[onboarding] upsert failed', error.message);
    // The 18+ trigger raises a plain exception; surface it as itself rather
    // than as a generic failure.
    if (error.message.includes('18 or older')) {
      return { ok: false, reason: 'You must be 18 or older to use SpiceSync.' };
    }
    return { ok: false, reason: 'Could not save your profile. Try again.' };
  }

  return { ok: true };
}
