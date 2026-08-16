import 'server-only';

import { createAdminClient } from '../supabase/admin.ts';
import { sanitiseTags } from '../dealbreakers.ts';
import { sanitisePsychAnswers, scorePsych, type PsychAnswer } from '../psych/psych-bank.ts';
import type { TasteVector } from '../food/types.ts';
import { diagnoseEmptyFeed, rankFor, type FeedDiagnosis } from './score.ts';
import type { Intent, MatchProfile } from './types.ts';

export type { FeedDiagnosis };

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
  attributes: string[] | null;
  non_negotiables: string[] | null;
}

const SELECT_COLUMNS =
  'id,name,date_of_birth,gender,seeking,intents,city,open_to_distance,age_min,age_max,taste,food_label,representative_dish,psych_answers,photo_paths,attributes,non_negotiables';

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
    nonNegotiables: sanitiseTags(row.non_negotiables),
    attributes: sanitiseTags(row.attributes),
  };
}

export interface Feed {
  cards: FeedCard[];
  /** Set when the viewer has no profile or no quiz result to rank against. */
  reason?: 'no-profile' | 'no-quiz' | 'unavailable';
  /** Why there are no cards. Absent whenever there are some. */
  diagnosis?: FeedDiagnosis;
  /** Settings of the VIEWER'S OWN that are doing the filtering, if any are. */
  widen?: Array<'age' | 'distance'>;
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

  for (const id of await blockedEitherWay(userId)) seen.add(id);

  const { data: rows } = await admin
    .from('profiles')
    .select(SELECT_COLUMNS)
    .eq('onboarding_complete', true)
    .is('suspended_at', null)
    .limit(500);

  // Kept as separate stages rather than one chain, because the count surviving
  // each one is the diagnosis: everybody, minus the people you have judged,
  // minus the people with no taste vector, minus the people your gates exclude.
  const others = (rows ?? []).filter((r) => (r as ProfileRow).id !== userId);
  const unjudged = others.filter((r) => !seen.has((r as ProfileRow).id));
  const candidates = unjudged
    .map((r) => toMatchProfile(r as ProfileRow))
    .filter((p): p is MatchProfile => p !== null);

  const { matches, blocked } = rankFor(me, candidates);
  const top = matches.slice(0, limit);

  if (top.length === 0) {
    const counts: Partial<Record<string, number>> = {};
    for (const b of blocked) counts[b.blocked] = (counts[b.blocked] ?? 0) + 1;

    // The numbers stay in the log rather than going to the screen. Aggregate
    // gate counts over a pool of two are facts about one identifiable person.
    console.info(
      '[explore] empty feed for %s — %d others, %d unjudged, %d rankable, blocked: %o',
      userId,
      others.length,
      unjudged.length,
      candidates.length,
      counts,
    );

    const { diagnosis, widen } = diagnoseEmptyFeed({
      others: others.length,
      unjudged: unjudged.length,
      rankable: candidates.length,
      blocked,
    });
    return { cards: [], diagnosis, ...(widen.length > 0 ? { widen } : {}) };
  }

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
 * Everyone invisible to this user because of a block, in either direction.
 *
 * Symmetry is the point. If it only hid people you blocked, the person you
 * blocked would keep seeing you — and if it only hid people who blocked you,
 * blocking would do nothing for the blocker. Either half alone also leaks: a
 * one-directional block is detectable by whoever is still being shown.
 */
async function blockedEitherWay(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const [mine, theirs] = await Promise.all([
    admin.from('blocks').select('blocked_id').eq('blocker_id', userId),
    admin.from('blocks').select('blocker_id').eq('blocked_id', userId),
  ]);
  return [
    ...(mine.data ?? []).map((r) => r.blocked_id as string),
    ...(theirs.data ?? []).map((r) => r.blocker_id as string),
  ];
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

export interface UndoState {
  /** A pass exists that could be undone. */
  hasPass: boolean;
  /** The daily allowance has not been spent. */
  available: boolean;
}

/**
 * Whether the undo button should be offered.
 *
 * The database enforces the limit regardless; this only decides what the
 * button says, so that pressing it is not the way someone finds out they
 * already used it today.
 */
export async function getUndoState(userId: string): Promise<UndoState> {
  const admin = createAdminClient();
  if (!admin) return { hasPass: false, available: false };

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [passes, used] = await Promise.all([
    admin.from('likes').select('liked_id').eq('liker_id', userId).eq('verdict', 'pass').limit(1),
    admin.from('pass_undos').select('used_on').eq('user_id', userId).eq('used_on', today).limit(1),
  ]);

  return {
    hasPass: (passes.data ?? []).length > 0,
    available: (used.data ?? []).length === 0,
  };
}

/**
 * Which Section 3 questions this person has already answered.
 *
 * Only the ids leave — the feed needs to know what to ask next, not what anyone
 * replied. For a signed-in user the profile row is the source of truth for this,
 * not the copy on the device: the drip questions are answered in the feed and
 * write straight here.
 */
export async function getAnsweredPsychIds(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from('profiles')
    .select('psych_answers')
    .eq('id', userId)
    .maybeSingle();
  return sanitisePsychAnswers(data?.psych_answers).map((a) => a.questionId);
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

  const hidden = new Set(await blockedEitherWay(userId));
  const visible = mutual.filter((id) => !hidden.has(id));
  if (visible.length === 0) return [];

  const { data: rows } = await admin
    .from('profiles')
    .select('id,name,food_label,photo_paths')
    .is('suspended_at', null)
    .in('id', visible);

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
