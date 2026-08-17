import { CUISINE_LABELS, DIET_BAND_ORDER, type Cuisine, type DietBand } from '../food/types.ts';
import { spiceLabel } from '../food/score-taste.ts';
import { ARCHETYPE_LABELS, type Archetype } from '../food/food-relationship.ts';
import { TRAITS, type Trait } from '../psych/psych-bank.ts';
import {
  INTENT_LABELS,
  type BlockReason,
  type BlockedMatch,
  type Intent,
  type MatchProfile,
  type ScoreComponents,
  type ScoredMatch,
} from './types.ts';

/**
 * The SpiceSync match score.
 *
 * Structure follows the brief's priority order — food first, then dealbreakers,
 * then psychological compatibility — but reorganised into two distinct stages,
 * because they are different kinds of question:
 *
 *   GATES decide whether a pair is permissible at all (gender, age, intent,
 *   distance, dealbreakers). These are boolean and they are not tradeable: no
 *   amount of shared taste in food compensates for a dealbreaker.
 *
 *   SCORE ranks the permissible ones. Food and psychology are weighted equally
 *   (0.4 / 0.4) with profile signals at 0.2, per the discovery decision.
 *
 * THREE PROPERTIES THIS FILE COMMITS TO
 * -------------------------------------
 * 1. SYMMETRY. score(a, b) === score(b, a). If two people see different numbers
 *    for each other, one of them is being lied to. Asymmetric preferences (a
 *    vegan cares more about diet than a meat-eater does) are resolved by taking
 *    the stricter view, not by producing two answers.
 *
 * 2. EXPLAINABILITY. Every score decomposes into chips. Joel, Eastwick & Finkel
 *    (2017) showed ML over self-reported traits cannot predict pre-meeting
 *    compatibility above chance, so a bare number here would be a claim we
 *    cannot support. "Both extra-spicy, neither wants kids soon" is checkable by
 *    the user and survives being wrong.
 *
 * 3. POPULATION-RELATIVE DISPLAY. The brief shows >70% at the top of Explore and
 *    a banner above 85%. Against absolute thresholds almost nobody clears 70% in
 *    a young pool and Explore renders empty on launch day — the single most
 *    common way a correct algorithm looks broken. The displayed number therefore
 *    blends absolute compatibility with rank inside the available pool.
 */

// ---------------------------------------------------------------------- gates

/** `exploring` means undecided, so it is compatible with any intention. */
function intentsOverlap(a: Intent[], b: Intent[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  if (a.includes('exploring') || b.includes('exploring')) return true;
  return a.some((i) => b.includes(i));
}

/**
 * Both people must have asked to see the other. This FAILS CLOSED.
 *
 * An empty `seeking` list is treated as "we do not know yet", not "no
 * preference" — so such a profile matches nobody until it is answered. The
 * opposite reading is tempting because it makes a half-built profile useful
 * immediately, and it is exactly the bug that shows a woman seeking men a feed
 * full of women. Any path that can produce a profile without preferences — an
 * abandoned onboarding, a partial import, a migration that adds the column
 * later — silently becomes a correctness failure the user notices before we do.
 *
 * Missing gender is treated the same way, for the same reason.
 */
function genderOk(a: MatchProfile, b: MatchProfile): boolean {
  if (a.seeking.length === 0 || b.seeking.length === 0) return false;
  if (!a.gender || !b.gender) return false;
  return a.seeking.includes(b.gender) && b.seeking.includes(a.gender);
}

function ageOk(a: MatchProfile, b: MatchProfile): boolean {
  return b.age >= a.ageMin && b.age <= a.ageMax && a.age >= b.ageMin && a.age <= b.ageMax;
}

/** A conflict in either direction blocks the pair. */
function dealbreakerOk(a: MatchProfile, b: MatchProfile): boolean {
  const aBlocksB = a.nonNegotiables.some((n) => b.attributes.includes(n));
  const bBlocksA = b.nonNegotiables.some((n) => a.attributes.includes(n));
  return !aBlocksB && !bBlocksA;
}

/**
 * Gates that do not depend on the score.
 *
 * Distance is deliberately NOT here. The brief's checkbox says to surface good
 * matches from further away *when the match score is high*, so it cannot be
 * evaluated before scoring — it is applied afterwards in `rankFor`.
 */
export function gateFor(a: MatchProfile, b: MatchProfile): BlockReason | null {
  if (a.id === b.id) return 'self';
  // Separated so an incomplete profile is diagnosable in the admin view rather
  // than looking like an ordinary preference mismatch.
  if (a.seeking.length === 0 || b.seeking.length === 0 || !a.gender || !b.gender) {
    return 'preferences_missing';
  }
  if (!genderOk(a, b)) return 'gender';
  if (!ageOk(a, b)) return 'age';
  if (!intentsOverlap(a.intents, b.intents)) return 'intent';
  if (!dealbreakerOk(a, b)) return 'dealbreaker';
  return null;
}

// ----------------------------------------------------------------- food score

/**
 * How much each diet band tolerates distance from its own position.
 *
 * Asymmetric on purpose. A vegan dating someone who orders bheja fry is a
 * materially different experience from that person dating a vegan, and treating
 * it as one symmetric distance flattens a real constraint. We evaluate both
 * directions and take the stricter, which keeps the pair score symmetric while
 * still respecting the narrower person's limits.
 */
const DIET_TOLERANCE: Record<DietBand, number> = {
  vegan: 0.3,
  all_veg: 0.45,
  mostly_veg: 0.7,
  mostly_non_veg: 0.9,
  generally_non_veg: 0.95,
  eats_anything: 1,
};

function dietFit(a: DietBand, b: DietBand): number {
  const ia = DIET_BAND_ORDER.indexOf(a);
  const ib = DIET_BAND_ORDER.indexOf(b);
  const distance = Math.abs(ia - ib) / (DIET_BAND_ORDER.length - 1);
  const fromA = Math.max(0, 1 - distance / DIET_TOLERANCE[a]);
  const fromB = Math.max(0, 1 - distance / DIET_TOLERANCE[b]);
  return Math.min(fromA, fromB);
}

/** Shared mass between two affinity distributions. 1 = identical, 0 = disjoint. */
function overlap(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let shared = 0;
  for (const k of keys) shared += Math.min(a[k] ?? 0, b[k] ?? 0);
  return Math.min(1, shared);
}

/**
 * Spice carries more weight than the other axes because it is half the card
 * label and the thing people actually argue about at a table. Novelty is next:
 * it tracks openness to experience, so it is the axis that reaches furthest
 * beyond food.
 */
const AXIS_WEIGHT = { spice: 0.4, novelty: 0.3, richness: 0.2, sweetness: 0.1 } as const;

function foodScore(a: MatchProfile, b: MatchProfile): number {
  let axisSim = 0;
  for (const [axis, w] of Object.entries(AXIS_WEIGHT) as Array<[keyof typeof AXIS_WEIGHT, number]>) {
    // Only trust an axis as far as both people's quizzes measured it.
    const confidence = Math.min(a.taste.confidence[axis], b.taste.confidence[axis]);
    const sim = 1 - Math.abs(a.taste[axis] - b.taste[axis]);
    axisSim += w * (confidence * sim + (1 - confidence) * 0.5);
  }

  const cuisine = overlap(a.taste.cuisine as Record<string, number>, b.taste.cuisine as Record<string, number>);
  const setting = overlap(a.taste.setting as Record<string, number>, b.taste.setting as Record<string, number>);
  const diet = dietFit(a.taste.dietBand, b.taste.dietBand);

  return 0.4 * axisSim + 0.25 * cuisine + 0.1 * setting + 0.25 * diet;
}

// ---------------------------------------------------------------- psych score

/**
 * Attachment is a combination effect, not a similarity one.
 *
 * An anxious person paired with an avoidant one is the most consistently
 * documented bad pairing in this literature — each partner's coping style is
 * precisely the other's trigger. Two secure people do well regardless of how
 * alike they are otherwise. So attachment is scored on the pairing, not on the
 * distance between two numbers.
 */
function attachmentAdjustment(a: MatchProfile, b: MatchProfile): number {
  const aAnx = a.psych.traits.attachment_anxiety;
  const aAvo = a.psych.traits.attachment_avoidance;
  const bAnx = b.psych.traits.attachment_anxiety;
  const bAvo = b.psych.traits.attachment_avoidance;

  const evidence = Math.min(
    a.psych.evidence.attachment_anxiety + a.psych.evidence.attachment_avoidance,
    b.psych.evidence.attachment_anxiety + b.psych.evidence.attachment_avoidance,
  );
  if (evidence < 2) return 0; // not measured well enough to act on

  // Worst case of the two anxious/avoidant orientations.
  const mismatch = Math.max(aAnx * bAvo, bAnx * aAvo);
  const bothSecure = (1 - aAnx) * (1 - aAvo) * (1 - bAnx) * (1 - bAvo);
  return 0.12 * bothSecure - 0.25 * Math.max(0, mismatch - 0.25);
}

function psychScore(a: MatchProfile, b: MatchProfile): number {
  let weighted = 0;
  let totalWeight = 0;

  for (const trait of Object.keys(TRAITS) as Trait[]) {
    const meta = TRAITS[trait];
    if (meta.use !== 'similarity') continue;
    // A trait neither person answered for tells us nothing; including it as
    // "0.5 vs 0.5 = perfectly similar" would manufacture agreement out of
    // silence, which is how you get 90% matches between two empty profiles.
    if (a.psych.evidence[trait] < 1 || b.psych.evidence[trait] < 1) continue;
    const sim = 1 - Math.abs(a.psych.traits[trait] - b.psych.traits[trait]);
    weighted += meta.weight * sim;
    totalWeight += meta.weight;
  }

  // With no overlapping answers at all, stay neutral rather than optimistic.
  const base = totalWeight > 0 ? weighted / totalWeight : 0.5;
  return Math.min(1, Math.max(0, base + attachmentAdjustment(a, b)));
}

// -------------------------------------------------------------- profile score

function intentScore(a: Intent[], b: Intent[]): number {
  if (a.length === 0 || b.length === 0) return 0.5;
  if (a.includes('exploring') || b.includes('exploring')) return 0.55;
  const setA = new Set(a);
  const setB = new Set(b);
  const shared = [...setA].filter((i) => setB.has(i)).length;
  const union = new Set([...a, ...b]).size;
  return shared / union; // Jaccard: wanting exactly the same things scores 1
}

function profileScore(a: MatchProfile, b: MatchProfile): number {
  const intent = intentScore(a.intents, b.intents);
  const age = Math.max(0, 1 - Math.abs(a.age - b.age) / 15);
  const place = a.city === b.city ? 1 : 0.4;
  return 0.5 * intent + 0.25 * age + 0.25 * place;
}

// --------------------------------------------------------------------- chips

/**
 * Why this person. These are the product — a score without them is a claim we
 * cannot back. Ordered strongest-first and capped, because five chips read as
 * noise where two read as insight.
 */
export function whyChips(a: MatchProfile, b: MatchProfile, limit = 4): string[] {
  const chips: string[] = [];

  const spiceGap = Math.abs(a.taste.spice - b.taste.spice);
  if (spiceGap < 0.15 && Math.min(a.taste.confidence.spice, b.taste.confidence.spice) > 0.4) {
    chips.push(`both ${spiceLabel(a.taste.spice).toLowerCase()}`);
  }

  // Ordered before the rest: sharing an archetype is one of the most human
  // things this card can say, and it was being crowded out by the four-chip cap.
  if (a.taste.archetype && a.taste.archetype === b.taste.archetype) {
    chips.push(`both ${ARCHETYPE_LABELS[a.taste.archetype as Archetype].toLowerCase()}s`);
  }

  // Not a compliment, and it belongs on the card anyway. One person for whom
  // food is everything and one who is indifferent is a real incompatibility,
  // and averaging the weights would otherwise hide it behind a decent number.
  const importanceGap = Math.abs((a.taste.foodWeight ?? 0.5) - (b.taste.foodWeight ?? 0.5));
  if (importanceGap > 0.45) chips.push('food matters much more to one of you');

  if (a.representativeDish && a.representativeDish === b.representativeDish) {
    chips.push(`you both picked ${a.representativeDish}`);
  }

  const topCuisine = (p: MatchProfile) =>
    (Object.entries(p.taste.cuisine) as Array<[Cuisine, number]>).sort((x, y) => y[1] - x[1])[0]?.[0];
  const ca = topCuisine(a);
  if (ca && ca === topCuisine(b)) chips.push(`${CUISINE_LABELS[ca].toLowerCase()} people`);

  const noveltyGap = Math.abs(a.taste.novelty - b.taste.novelty);
  let noveltyChipped = false;
  if (noveltyGap < 0.2 && a.taste.novelty > 0.65) {
    chips.push('both order the unfamiliar thing');
    noveltyChipped = true;
  } else if (noveltyGap < 0.2 && a.taste.novelty < 0.3) {
    chips.push('both have a usual');
    noveltyChipped = true;
  }

  // Strongest shared psychological traits, by how far from neutral they agree.
  const shared = (Object.keys(TRAITS) as Trait[])
    .filter((t) => TRAITS[t].use === 'similarity')
    .filter((t) => a.psych.evidence[t] >= 1 && b.psych.evidence[t] >= 1)
    .filter((t) => Math.abs(a.psych.traits[t] - b.psych.traits[t]) < 0.2)
    .map((t) => ({ t, strength: Math.abs((a.psych.traits[t] + b.psych.traits[t]) / 2 - 0.5) }))
    .filter((x) => x.strength > 0.18)
    .sort((x, y) => y.strength - x.strength);

  for (const { t } of shared) {
    // Food novelty and psychological openness measure adjacent things. When the
    // quiz and the questionnaire disagree, showing both reads as a contradiction
    // ("both have a usual · both are up for anything") and undermines the whole
    // card. The food chip is the more concrete of the two, so it wins.
    if (t === 'openness' && noveltyChipped) continue;
    const mean = (a.psych.traits[t] + b.psych.traits[t]) / 2;
    chips.push(`both ${mean > 0.5 ? TRAITS[t].highPair : TRAITS[t].lowPair}`);
  }

  const sharedIntent = a.intents.find((i) => b.intents.includes(i) && i !== 'exploring');
  if (sharedIntent) chips.push(`both here for ${INTENT_LABELS[sharedIntent].toLowerCase()}`);

  if (a.nonNegotiables.length > 0 || b.nonNegotiables.length > 0) {
    chips.push('no dealbreakers between you');
  }

  return chips.slice(0, limit);
}

// --------------------------------------------------------------------- scorer

/** Profile signals are a fixed share; food and psychology split the rest. */
export const PROFILE_WEIGHT = 0.2;
/**
 * Food never falls below this share nor rises above it, whatever the two people
 * asked for. Someone saying food is everything should not reduce psychological
 * compatibility to noise, and someone saying it is irrelevant should not erase
 * the half of the product that measures how they eat.
 */
export const FOOD_WEIGHT_FLOOR = 0.2;
export const FOOD_WEIGHT_CEILING = 0.6;

/**
 * How heavily food counts for this pair.
 *
 * Averaged from both people's stated importance, which is what keeps the score
 * symmetric — `score(a,b)` must equal `score(b,a)`, or two people comparing
 * screens see different numbers for each other and one of them is being lied
 * to. Taking the stricter of the two would instead let one person's priorities
 * silently govern someone else's feed.
 */
export function pairWeights(a: MatchProfile, b: MatchProfile): {
  food: number;
  psych: number;
  profile: number;
} {
  const average = ((a.taste.foodWeight ?? 0.5) + (b.taste.foodWeight ?? 0.5)) / 2;
  const food = FOOD_WEIGHT_FLOOR + (FOOD_WEIGHT_CEILING - FOOD_WEIGHT_FLOOR) * average;
  return { food, psych: 1 - PROFILE_WEIGHT - food, profile: PROFILE_WEIGHT };
}

export function scorePair(a: MatchProfile, b: MatchProfile): {
  raw: number;
  components: ScoreComponents;
} {
  const components: ScoreComponents = {
    food: foodScore(a, b),
    psych: psychScore(a, b),
    profile: profileScore(a, b),
  };
  const w = pairWeights(a, b);
  const raw = w.food * components.food + w.psych * components.psych + w.profile * components.profile;
  return { raw: Math.min(1, Math.max(0, raw)), components };
}

// ------------------------------------------------------------------- ranking

/** Below this many candidates, a percentage is theatre. Show order, not numbers. */
export const MIN_POOL_FOR_SCORES = 25;
/** The banner promises a real-world meeting; rank alone must not earn it. */
export const RAW_FLOOR_FOR_BANNER = 0.62;
export const BANNER_THRESHOLD = 85;
export const TOP_THRESHOLD = 70;
/** Someone in another city has to clear this to appear at all. */
export const DISTANCE_DISPLAY_FLOOR = 78;

export interface RankResult {
  matches: ScoredMatch[];
  blocked: BlockedMatch[];
  poolSize: number;
}

/**
 * Why a feed came back empty.
 *
 * An empty feed has several very different causes and they looked identical on
 * screen — "Nobody here yet", whether nobody had signed up or everyone had and
 * none of them was rankable. Migration 0009 wiped every taste vector, which
 * drops its owner out of every pool until they retake Section 2, and nothing
 * distinguished that from an empty city.
 *
 * Pure, and here rather than in `pool.ts`, so the harness can hold it to the
 * rule below without a database.
 *
 * WHAT THIS MAY NOT SAY. Only the state of the app and the viewer's OWN
 * settings. In a pool of two, "ruled out by a dealbreaker" or "by gender" is a
 * fact about the only other account, so `widen` names age and distance and
 * nothing else — those are the viewer's own filters, adjustable in settings.
 * Counts stay in the server log.
 */
export type FeedDiagnosis = 'no-candidates' | 'awaiting-quiz' | 'all-judged' | 'filtered';

export interface EmptyFeedDiagnosis {
  diagnosis: FeedDiagnosis;
  widen: Array<'age' | 'distance'>;
}

export function diagnoseEmptyFeed(counts: {
  /** Everyone with a finished profile, excluding the viewer. */
  others: number;
  /** Of those, everyone the viewer has not already judged or blocked. */
  unjudged: number;
  /** Of those, everyone with a taste vector to rank. */
  rankable: number;
  blocked: BlockedMatch[];
}): EmptyFeedDiagnosis {
  const reasons = new Set(counts.blocked.map((b) => b.blocked));
  const widen: Array<'age' | 'distance'> = [];
  if (reasons.has('age')) widen.push('age');
  if (reasons.has('distance')) widen.push('distance');

  const diagnosis: FeedDiagnosis =
    counts.others === 0 ? 'no-candidates'
      : counts.unjudged === 0 ? 'all-judged'
        : counts.rankable === 0 ? 'awaiting-quiz'
          : 'filtered';

  return { diagnosis, widen };
}

/**
 * Rank a pool for one person.
 *
 * The displayed number is a 50/50 blend of absolute compatibility and rank
 * within the pool. Pure absolute leaves Explore empty at launch; pure percentile
 * would crown a "94% match" in a pool of four, which is a promise the product
 * cannot keep. Blending gives a feed that is populated from day one and a number
 * that still degrades honestly when nobody available is a good fit.
 */
export function rankFor(me: MatchProfile, pool: MatchProfile[]): RankResult {
  const blocked: BlockedMatch[] = [];
  const permitted: Array<{ profile: MatchProfile; raw: number; components: ScoreComponents }> = [];

  for (const candidate of pool) {
    const gate = gateFor(me, candidate);
    if (gate) {
      blocked.push({ profile: candidate, blocked: gate });
      continue;
    }
    permitted.push({ profile: candidate, ...scorePair(me, candidate) });
  }

  permitted.sort((x, y) => y.raw - x.raw);
  const n = permitted.length;
  const poolBigEnough = n >= MIN_POOL_FOR_SCORES;

  const matches: ScoredMatch[] = permitted.map((entry, index) => {
    // Rank 0 is the best; percentile 1 means "better than everyone else here".
    const percentile = n > 1 ? 1 - index / (n - 1) : 1;
    const displayScore = Math.round(100 * (0.5 * percentile + 0.5 * entry.raw));
    const sameCity = me.city === entry.profile.city;
    const chips = whyChips(me, entry.profile);

    // A number with nothing behind it is the exact thing this product refuses to
    // ship. Two people can be permissible and still give us nothing to say —
    // typically low-similarity pairs where the viewer has not answered Section 3
    // — and for those the honest move is to show the person without the score,
    // not to invent a reason. Enforced here rather than in the card so no future
    // screen can render around it.
    const explainable = chips.length > 0;
    const showScore = poolBigEnough && explainable;
    const banner = showScore && displayScore >= BANNER_THRESHOLD && entry.raw >= RAW_FLOOR_FOR_BANNER;

    return {
      profile: entry.profile,
      raw: entry.raw,
      components: entry.components,
      displayScore,
      showScore,
      chips,
      banner,
      _sameCity: sameCity,
    } as ScoredMatch & { _sameCity: boolean };
  });

  // The brief's distance checkbox: someone further away appears only if BOTH
  // people opted in and the match is strong enough to justify the trip.
  const filtered = (matches as Array<ScoredMatch & { _sameCity: boolean }>).filter((m) => {
    if (m._sameCity) return true;
    const bothOptedIn = me.openToDistance && m.profile.openToDistance;
    if (!bothOptedIn) {
      blocked.push({ profile: m.profile, blocked: 'distance' });
      return false;
    }
    if (m.displayScore < DISTANCE_DISPLAY_FLOOR) {
      blocked.push({ profile: m.profile, blocked: 'distance' });
      return false;
    }
    return true;
  });

  for (const m of filtered) delete (m as { _sameCity?: boolean })._sameCity;

  return { matches: filtered, blocked, poolSize: n };
}
