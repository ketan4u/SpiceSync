import 'server-only';

import { createAdminClient } from '../supabase/admin.ts';
import { scorePsych, type PsychAnswer } from '../psych/psych-bank.ts';
import type { TasteVector } from '../food/types.ts';
import { rankFor } from './score.ts';
import type { Intent, MatchProfile } from './types.ts';

/**
 * Builds and ranks the real feed.
 *
 * This is the only place candidate rows are read, and the only place raw psych
 * answers exist outside their owner's own session. Nothing here returns a row;
 * everything leaves as a `FeedCard`, which is deliberately narrow.
 */

/** What a card is allowed to know. No psych answers, no date of birth. */
export interface FeedCard {
  id: string;
  name: string;
  age: number;
  city: string;
  foodLabel: string | null;
  representativeDish: string | null;
  photoUrl: string | null;
  dishPhotoUrl: string | null;
  displayScore: number;
  showScore: boolean;
  banner: boolean;
  chips: string[];
}

interface ProfileRow {
  id: string;
  name: string;
  date_of_birth: string;
  gender: string;
  seeking: string[];
  intents: string[];
  city: string;
  open_to_distance: boolean;
  age_min: number;
  age_max: number;
  taste: TasteVector | null;
  food_label: string | null;
  representative_dish: string | null;
  psych_answers: PsychAnswer[] | null;
  photo_paths: string[] | null;
}

const SELECT_COLUMNS =
  'id,name,date_of_birth,gender,seeking,intents,city,open_to_distance,age_min,age_max,taste,food_label,representative_dish,psych_answers,photo_paths';

function ageFrom(dob: string): number {
  const birth = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

function toMatchProfile(row: ProfileRow): MatchProfile | null {
  // Someone who signed up before taking the quiz has nothing to match on. They
  // are skipped rather than scored against a fabricated vector.
  if (!row.taste) return null;
  return {
    id: row.id,
    age: ageFrom(row.date_of_birth),
    gender: row.gender,
    seeking: row.seeking ?? [],
    ageMin: row.age_min,
    ageMax: row.age_max,
    city: row.city,
    intents: (row.intents ?? []) as Intent[],
    openToDistance: row.open_to_distance,
    taste: row.taste,
    representativeDish: row.representative_dish ?? undefined,
    psych: scorePsych(row.psych_answers ?? []),
    // Section 1's dealbreaker fields are not collected yet, so the gate has
    // nothing to act on. Wiring them is what makes it meaningful.
    nonNegotiables: [],
    attributes: [],
  };
}

export interface Feed {
  cards: FeedCard[];
  /** Set when the viewer has no profile or no quiz result to rank against. */
  reason?: 'no-profile' | 'no-quiz' | 'unavailable';
}

export async function getFeed(userId: string, limit = 40): Promise<Feed> {
  const admin = createAdminClient();
  if (!admin) return { cards: [], reason: 'unavailable' };

  const { data: meRow, error: meErr } = await admin
    .from('profiles')
    .select(SELECT_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (meErr || !meRow) return { cards: [], reason: 'no-profile' };
  const me = toMatchProfile(meRow as ProfileRow);
  if (!me) return { cards: [], reason: 'no-quiz' };

  // Everyone this person has already judged drops out of the pool.
  const { data: judged } = await admin
    .from('likes')
    .select('liked_id')
    .eq('liker_id', userId);
  const seen = new Set((judged ?? []).map((r) => r.liked_id as string));
  seen.add(userId);

  const { data: rows } = await admin
    .from('profiles')
    .select(SELECT_COLUMNS)
    .eq('onboarding_complete', true)
    .limit(500);

  const candidates = (rows ?? [])
    .filter((r) => !seen.has((r as ProfileRow).id))
    .map((r) => toMatchProfile(r as ProfileRow))
    .filter((p): p is MatchProfile => p !== null);

  const { matches } = rankFor(me, candidates);
  const top = matches.slice(0, limit);

  const byId = new Map((rows ?? []).map((r) => [(r as ProfileRow).id, r as ProfileRow]));

  return {
    cards: await Promise.all(
      top.map(async (m) => {
        const row = byId.get(m.profile.id)!;
        const [photoUrl, dishPhotoUrl] = await signedUrls(row.photo_paths ?? []);
        return {
          id: row.id,
          name: row.name,
          age: ageFrom(row.date_of_birth),
          city: row.city,
          foodLabel: row.food_label,
          representativeDish: row.representative_dish,
          photoUrl,
          dishPhotoUrl,
          displayScore: m.displayScore,
          showScore: m.showScore,
          banner: m.banner,
          chips: m.chips,
        } satisfies FeedCard;
      }),
    ),
  };
}

/**
 * Photos are in a private bucket with no read policy, so they are only
 * reachable through a link the server mints. Short-lived on purpose: a leaked
 * URL stops working rather than becoming a permanent handle on someone's face.
 */
const SIGNED_URL_TTL_SECONDS = 60 * 30;

async function signedUrls(paths: string[]): Promise<[string | null, string | null]> {
  const admin = createAdminClient();
  if (!admin || paths.length === 0) return [null, null];
  const signed = await Promise.all(
    [paths[0], paths[1]].map(async (p) => {
      if (!p) return null;
      const { data } = await admin.storage.from('photos').createSignedUrl(p, SIGNED_URL_TTL_SECONDS);
      return data?.signedUrl ?? null;
    }),
  );
  return [signed[0], signed[1]];
}

/** Someone you liked who had already liked you. */
export interface MatchSummary {
  id: string;
  name: string;
  foodLabel: string | null;
  photoUrl: string | null;
}

export async function getMatches(userId: string): Promise<MatchSummary[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data: mine } = await admin
    .from('likes')
    .select('liked_id')
    .eq('liker_id', userId)
    .eq('verdict', 'like');
  const likedByMe = (mine ?? []).map((r) => r.liked_id as string);
  if (likedByMe.length === 0) return [];

  const { data: back } = await admin
    .from('likes')
    .select('liker_id')
    .eq('liked_id', userId)
    .eq('verdict', 'like')
    .in('liker_id', likedByMe);
  const mutual = (back ?? []).map((r) => r.liker_id as string);
  if (mutual.length === 0) return [];

  const { data: rows } = await admin
    .from('profiles')
    .select('id,name,food_label,photo_paths')
    .in('id', mutual);

  return Promise.all(
    (rows ?? []).map(async (r) => {
      const [photoUrl] = await signedUrls((r.photo_paths as string[]) ?? []);
      return {
        id: r.id as string,
        name: r.name as string,
        foodLabel: (r.food_label as string) ?? null,
        photoUrl,
      };
    }),
  );
}
