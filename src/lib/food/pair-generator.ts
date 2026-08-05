import { bandWeight, poolFor } from './food-catalog.ts';
import type { TasteAccumulator } from './score-taste.ts';
import { finalise, rawAxisEstimates } from './score-taste.ts';
import {
  CONTINUOUS_AXES,
  type ContinuousAxis,
  type Cuisine,
  type FoodItem,
  type QuizPair,
  type Setting,
} from './types.ts';

/**
 * Builds the pairs shown in Section 2.
 *
 * Rounds 1-4 are fixed CALIBRATION probes, one per high-value axis, chosen to
 * span the range so the weighted average has something to work with.
 * Rounds 5-8 are ADAPTIVE: each targets whichever axis currently has the least
 * evidence, and picks the pair that discriminates hardest near the running
 * estimate — standard adaptive preference elicitation.
 *
 * A good probe is a CLEAN one: large contrast on the target axis, small contrast
 * on every other axis. Otherwise we cannot attribute the tap. "Ghee roast
 * chicken vs idli" tells you nothing — it differs on all four axes at once.
 */

export type ProbeTarget = ContinuousAxis | 'cuisine' | 'setting';

/** Deterministic PRNG so quiz runs are reproducible in tests and replayable in
 *  the admin debug view. Seed per session, not per user, so a retake varies. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CALIBRATION_ORDER: ProbeTarget[] = ['spice', 'cuisine', 'novelty', 'sweetness'];

/** Pairs scoring within this fraction of the best are treated as equivalent and
 *  sampled among, so two users with identical answers don't see identical quizzes. */
const TOP_N = 5;

export const DEFAULT_ROUNDS = 8;
export const MIN_ROUNDS = 6;

function otherAxes(target: ContinuousAxis): ContinuousAxis[] {
  return CONTINUOUS_AXES.filter((a) => a !== target);
}

function meanContrast(a: FoodItem, b: FoodItem, axes: ContinuousAxis[]): number {
  if (axes.length === 0) return 0;
  return axes.reduce((sum, axis) => sum + Math.abs(a[axis] - b[axis]), 0) / axes.length;
}

/** How much evidence each target currently has, 0..1. Lower = probe it next. */
function evidenceByTarget(acc: TasteAccumulator): Record<ProbeTarget, number> {
  const v = finalise(acc);
  return {
    spice: v.confidence.spice,
    richness: v.confidence.richness,
    novelty: v.confidence.novelty,
    sweetness: v.confidence.sweetness,
    cuisine: v.confidence.cuisine,
    setting: v.confidence.setting,
  };
}

function scoreContinuousPair(
  a: FoodItem,
  b: FoodItem,
  axis: ContinuousAxis,
  estimate: number,
): number {
  const contrast = Math.abs(a[axis] - b[axis]);
  if (contrast < 0.25) return -Infinity; // too close to teach us anything
  const noise = meanContrast(a, b, otherAxes(axis));
  const midpoint = (a[axis] + b[axis]) / 2;
  // Reward: big clean contrast, straddling the current estimate.
  return contrast - 0.5 * noise - 0.8 * Math.abs(midpoint - estimate);
}

function scoreCuisinePair(
  a: FoodItem,
  b: FoodItem,
  cuisineEvidence: Record<string, number>,
  declared: Cuisine[],
): number {
  if (a.cuisine === b.cuisine) return -Infinity;
  // Want dishes that are similar in every way EXCEPT which kitchen they came
  // from, so the tap is attributable to cuisine and not to heat or richness.
  const noise = meanContrast(a, b, CONTINUOUS_AXES);
  const seenA = Math.abs(cuisineEvidence[a.cuisine] ?? 0);
  const seenB = Math.abs(cuisineEvidence[b.cuisine] ?? 0);
  // If the user ticked cuisines up front, the useful question is which of THOSE
  // wins a head-to-head — not whether they prefer one they never claimed.
  const declaredHits =
    (declared.includes(a.cuisine) ? 1 : 0) + (declared.includes(b.cuisine) ? 1 : 0);
  const declaredBonus = declared.length > 0 ? 0.4 * declaredHits : 0;
  return -noise - 0.15 * (seenA + seenB) + declaredBonus;
}

function scoreSettingPair(a: FoodItem, b: FoodItem): number {
  if (a.setting === b.setting) return -Infinity;
  return -meanContrast(a, b, CONTINUOUS_AXES);
}

/**
 * Pick the next pair, or null if the pool is exhausted.
 * `round` is 1-indexed.
 */
export function nextPair(
  acc: TasteAccumulator,
  round: number,
  rng: () => number,
  totalRounds: number = DEFAULT_ROUNDS,
): QuizPair | null {
  const pool = poolFor(acc.dietBand).filter((item) => !acc.seen.has(item.id));
  if (pool.length < 2) return null;

  let target: ProbeTarget;
  if (round <= CALIBRATION_ORDER.length && round <= totalRounds) {
    target = CALIBRATION_ORDER[round - 1];
  } else {
    const evidence = evidenceByTarget(acc);
    target = (Object.entries(evidence) as Array<[ProbeTarget, number]>).reduce(
      (least, cur) => (cur[1] < least[1] ? cur : least),
    )[0];
  }

  // Raw space: pair scoring compares against actual catalog values.
  const estimates = rawAxisEstimates(acc);
  const scored: Array<{ a: FoodItem; b: FoodItem; score: number }> = [];

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      let score: number;
      if (target === 'cuisine') {
        score = scoreCuisinePair(a, b, acc.cuisine, acc.declaredCuisines);
      } else if (target === 'setting') {
        score = scoreSettingPair(a, b);
      } else {
        score = scoreContinuousPair(a, b, target, estimates[target]);
      }
      if (score === -Infinity) continue;
      // Bias toward items this band actually eats, without ever excluding.
      score += 0.1 * (bandWeight(acc.dietBand, a) + bandWeight(acc.dietBand, b));
      scored.push({ a, b, score });
    }
  }

  if (scored.length === 0) {
    // No clean probe left for this target — fall back to any unseen pair so the
    // quiz never dead-ends on a user with a narrow diet band.
    const a = pool[Math.floor(rng() * pool.length)];
    const b = pool.find((item) => item.id !== a.id);
    if (!b) return null;
    return { round, left: a, right: b, probing: target };
  }

  scored.sort((x, y) => y.score - x.score);
  const candidates = scored.slice(0, Math.min(TOP_N, scored.length));
  const picked = candidates[Math.floor(rng() * candidates.length)];

  // Randomise which side each item appears on — position bias is real.
  const flip = rng() < 0.5;
  return {
    round,
    left: flip ? picked.b : picked.a,
    right: flip ? picked.a : picked.b,
    probing: target,
  };
}

/** Convenience for the result screen: the highest-affinity item actually chosen,
 *  used as the food photo on the person's profile card. */
export function representativeItem(
  acc: TasteAccumulator,
  getItem: (id: string) => FoodItem,
): FoodItem | null {
  const wins = acc.choices.filter((c) => !c.skipped);
  if (wins.length === 0) return null;
  const v = finalise(acc);
  const raw = rawAxisEstimates(acc);
  const distance = (item: FoodItem) =>
    CONTINUOUS_AXES.reduce((sum, axis) => sum + (item[axis] - raw[axis]) ** 2, 0) -
    // prefer an item from the cuisine they scored highest in
    2 * ((v.cuisine as Record<Cuisine, number>)[item.cuisine] ?? 0) -
    // and one whose setting matches
    1 * ((v.setting as Record<Setting, number>)[item.setting] ?? 0);
  return wins
    .map((c) => getItem(c.winnerId))
    .reduce((best, cur) => (distance(cur) < distance(best) ? cur : best));
}
