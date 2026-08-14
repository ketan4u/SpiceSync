'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isKnownCity } from '../../lib/cities.ts';
import { sanitiseTags } from '../../lib/dealbreakers.ts';
import { INTENTS, type Intent } from '../../lib/match/types.ts';
import { createClient } from '../../lib/supabase/server.ts';
import { createAdminClient } from '../../lib/supabase/admin.ts';
import {
  mergePsychAnswers,
  sanitisePsychAnswers,
  type PsychAnswer,
} from '../../lib/psych/psych-bank.ts';
import type { TasteVector } from '../../lib/food/types.ts';
import { sanitiseFoodAnswers, type FoodAnswer } from '../../lib/food/food-relationship.ts';

type Result = { ok: boolean; error?: string };

const GENDERS = ['woman', 'man', 'non-binary'];

export async function updateProfile(payload: {
  name: string;
  gender: string;
  seeking: string[];
  intents: string[];
  city: string;
  openToDistance: boolean;
  ageMin: number;
  ageMax: number;
  attributes: string[];
  nonNegotiables: string[];
}): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Not signed in.' };

  // The same checks onboarding makes. A settings screen is a second door into
  // the same row, and a rule enforced at only one door is not enforced.
  const name = payload.name.trim();
  if (!name || name.length > 60) return { ok: false, error: 'Add a name.' };
  if (!GENDERS.includes(payload.gender)) return { ok: false, error: 'Choose a gender.' };

  const seeking = payload.seeking.filter((g) => GENDERS.includes(g));
  if (seeking.length === 0) return { ok: false, error: 'Choose who you want to see.' };

  const intents = payload.intents.filter((i): i is Intent => INTENTS.includes(i as Intent));
  if (intents.length === 0) return { ok: false, error: 'Choose what you are here for.' };
  if (intents.includes('exploring') && intents.length > 1) {
    return { ok: false, error: 'Exploring cannot be combined with anything else.' };
  }

  if (!isKnownCity(payload.city)) return { ok: false, error: 'Choose your city.' };

  const ageMin = Math.max(18, Math.min(99, Math.round(payload.ageMin)));
  const ageMax = Math.max(ageMin, Math.min(99, Math.round(payload.ageMax)));

  const { error } = await supabase
    .from('profiles')
    .update({
      name,
      gender: payload.gender,
      seeking,
      intents,
      city: payload.city,
      open_to_distance: payload.openToDistance,
      age_min: ageMin,
      age_max: ageMax,
      attributes: sanitiseTags(payload.attributes),
      non_negotiables: sanitiseTags(payload.nonNegotiables),
    })
    .eq('id', auth.user.id);

  if (error) {
    console.error('[settings] update failed', error.message);
    return { ok: false, error: 'Could not save. Try again.' };
  }
  revalidatePath('/settings');
  revalidatePath('/explore');
  return { ok: true };
}

/**
 * Pushes a retaken quiz, or newly answered questions, onto the profile.
 *
 * Without this, retaking the quiz while signed in changes only the copy held on
 * the device and matching carries on using whatever was captured at signup.
 */
export async function syncFromDevice(payload: {
  dietBand?: string;
  declaredCuisines?: string[];
  taste?: TasteVector;
  foodLabel?: string;
  representativeDish?: string;
  psychAnswers?: PsychAnswer[];
  foodAnswers?: FoodAnswer[];
}): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Not signed in.' };

  const update: Record<string, unknown> = {};
  if (payload.taste) {
    update.taste = payload.taste;
    update.diet_band = payload.dietBand ?? null;
    update.declared_cuisines = payload.declaredCuisines ?? [];
    update.food_label = payload.foodLabel ?? null;
    update.representative_dish = payload.representativeDish ?? null;
    update.food_answers = sanitiseFoodAnswers(payload.foodAnswers);
    update.food_archetype = payload.taste.archetype ?? null;
    update.food_weight = payload.taste.foodWeight ?? null;
  }
  // Merged, not overwritten. The device holds whatever was answered at
  // /questions; the profile also holds the drip questions answered in the feed,
  // which never touch the device. Writing either one over the other silently
  // deletes real answers — and the ones lost would be the hardest to re-earn,
  // because a drip question only comes back around every fourth card.
  const incoming = sanitisePsychAnswers(payload.psychAnswers);
  if (incoming.length > 0) {
    const { data: row } = await supabase
      .from('profiles')
      .select('psych_answers')
      .eq('id', auth.user.id)
      .maybeSingle();
    update.psych_answers = mergePsychAnswers(sanitisePsychAnswers(row?.psych_answers), incoming);
  }
  if (Object.keys(update).length === 0) return { ok: false, error: 'Nothing to sync.' };

  const { error } = await supabase.from('profiles').update(update).eq('id', auth.user.id);
  if (error) {
    console.error('[settings] sync failed', error.message);
    // A missing column means an unapplied migration, not something the user did
    // wrong. Saying "could not sync" sends them looking at their answers.
    if (/column .* does not exist|schema cache/i.test(error.message)) {
      return { ok: false, error: 'The database is missing a migration. Apply supabase/migrations and try again.' };
    }
    return { ok: false, error: 'Could not sync. Try again.' };
  }
  revalidatePath('/settings');
  revalidatePath('/explore');
  return { ok: true };
}

export async function unblock(blockedId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Not signed in.' };
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', auth.user.id)
    .eq('blocked_id', blockedId);
  if (error) {
    console.error('[settings] unblock failed', error.message);
    return { ok: false, error: 'Could not unblock.' };
  }
  revalidatePath('/settings');
  return { ok: true };
}

/**
 * Deletes the account and everything attached to it.
 *
 * This is the DPDP right to erasure, so it is a real delete rather than a flag.
 * Profile, likes, blocks and messages all hang off auth.users with ON DELETE
 * CASCADE and go with it; storage objects do not cascade and are removed
 * explicitly first, because a deleted account whose photos survive is the worst
 * possible outcome of pressing this button.
 */
export async function deleteAccount(confirmation: string): Promise<Result> {
  if (confirmation.trim().toUpperCase() !== 'DELETE') {
    return { ok: false, error: 'Type DELETE to confirm.' };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Not signed in.' };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: 'Deletion is not configured on this build.' };

  const userId = auth.user.id;

  const { data: files } = await admin.storage.from('photos').list(userId);
  if (files && files.length > 0) {
    await admin.storage.from('photos').remove(files.map((f) => `${userId}/${f.name}`));
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('[settings] delete failed', error.message);
    return { ok: false, error: 'Could not delete the account. Try again.' };
  }

  await supabase.auth.signOut();
  redirect('/');
}
