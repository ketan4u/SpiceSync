import { POOL_CALIBRATION } from './pool-calibration.ts';
import {
  CONTINUOUS_AXES,
  CUISINE_LABELS,
  type ContinuousAxis,
  type Cuisine,
  type DietBand,
  type FoodItem,
  type QuizChoice,
  type Setting,
  type TasteVector,
} from './types.ts';

/**
 * Turns a sequence of A/B choices into a taste vector.
 *
 * Model: contrast-weighted attribution. When a user picks A over B we ask, per
 * axis, "how much of this decision could this axis explain?" — an axis where the
 * two items differ a lot gets most of the credit; an axis where they are nearly
 * identical gets none. We then accumulate a weighted average of the winners'
 * values on each axis.
 *
 * Two properties this buys us, both of which the plan's verification depends on:
 *
 *   1. ORDER INDEPENDENCE. Given the same set of choices, the resulting vector
 *      is identical regardless of the order they were made in. This is precisely
 *      what the original king-of-the-hill mechanic could not offer.
 *   2. GRACEFUL CONTRADICTION. Eight taps from a human are noisy. A weighted
 *      average degrades toward the middle under conflicting evidence rather than
 *      thrashing, which a threshold/bounds model would do.
 *
 * The tradeoff, stated plainly: this estimates a preferred REGION, not a strict
 * ideal point. Someone who loves both mild khichdi and extra-spicy misal reads
 * as "medium". That is acceptable — the calibration pairs are built to span the
 * range, and the confidence score tells the UI when not to trust an axis.
 */

/** Below this, the two items are effectively tied on the axis — no evidence. */
const MIN_CONTRAST = 0.15;

/** Penalty applied to the losing item's cuisine/setting. Deliberately small:
 *  rejecting a dish is much weaker evidence than choosing one. */
const LOSER_PENALTY = 0.4;

/** Half-saturation constant for turning accumulated evidence into 0..1 confidence. */
const CONFIDENCE_K = 0.5;

export interface TasteAccumulator {
  dietBand: DietBand;
  /** Ticked on the tile grid shown with the diet-band gate. May be empty if the
   *  user skipped it — the quiz still works, just with a fuzzier cuisine read. */
  declaredCuisines: Cuisine[];
  num: Record<ContinuousAxis, number>;
  den: Record<ContinuousAxis, number>;
  cuisine: Record<string, number>;
  setting: Record<string, number>;
  cuisineEvidence: number;
  settingEvidence: number;
  seen: Set<string>;
  choices: QuizChoice[];
}

export function createAccumulator(
  dietBand: DietBand,
  declaredCuisines: Cuisine[] = [],
): TasteAccumulator {
  const zeroAxes = () =>
    Object.fromEntries(CONTINUOUS_AXES.map((a) => [a, 0])) as Record<ContinuousAxis, number>;
  return {
    dietBand,
    declaredCuisines,
    num: zeroAxes(),
    den: zeroAxes(),
    cuisine: {},
    setting: {},
    cuisineEvidence: 0,
    settingEvidence: 0,
    seen: new Set(),
    choices: [],
  };
}

export function applyChoice(
  acc: TasteAccumulator,
  choice: QuizChoice,
  winner: FoodItem,
  loser: FoodItem,
): void {
  acc.choices.push(choice);
  acc.seen.add(winner.id);
  acc.seen.add(loser.id);

  // "Neither" is recorded (it is useful analytics about the catalog) but
  // contributes no preference evidence.
  if (choice.skipped) return;

  const contrasts = CONTINUOUS_AXES.map((axis) => Math.abs(winner[axis] - loser[axis]));
  const totalContrast = contrasts.reduce((a, b) => a + b, 0);

  if (totalContrast > 0) {
    CONTINUOUS_AXES.forEach((axis, i) => {
      const contrast = contrasts[i];
      if (contrast < MIN_CONTRAST) return;
      // share = how much of this decision this axis plausibly explains.
      const share = contrast / totalContrast;
      const weight = contrast * share;
      acc.num[axis] += weight * winner[axis];
      acc.den[axis] += weight;
    });
  }

  if (winner.cuisine !== loser.cuisine) {
    acc.cuisine[winner.cuisine] = (acc.cuisine[winner.cuisine] ?? 0) + 1;
    acc.cuisine[loser.cuisine] = (acc.cuisine[loser.cuisine] ?? 0) - LOSER_PENALTY;
    acc.cuisineEvidence += 1;
  }

  if (winner.setting !== loser.setting) {
    acc.setting[winner.setting] = (acc.setting[winner.setting] ?? 0) + 1;
    acc.setting[loser.setting] = (acc.setting[loser.setting] ?? 0) - LOSER_PENALTY;
    acc.settingEvidence += 1;
  }
}

/** Shift to non-negative and normalise to sum 1. Empty input => empty record. */
function normalise<K extends string>(raw: Record<string, number>): Record<K, number> {
  const keys = Object.keys(raw);
  if (keys.length === 0) return {} as Record<K, number>;
  const min = Math.min(...keys.map((k) => raw[k]));
  const shifted = keys.map((k) => raw[k] - min + 0.01);
  const total = shifted.reduce((a, b) => a + b, 0);
  return Object.fromEntries(keys.map((k, i) => [k, shifted[i] / total])) as Record<K, number>;
}

function confidenceFrom(evidence: number): number {
  return evidence / (evidence + CONFIDENCE_K);
}

/**
 * How strongly a cuisine the user explicitly ticked outranks one they did not.
 *
 * WHY CUISINE IS DECLARED, NOT INFERRED
 * -------------------------------------
 * Eight rounds yield only two or three taps where the two dishes came from
 * different kitchens. Measured over 1000 simulated users, that identifies the
 * right cuisine out of nine about 22% of the time — better than the 11% chance
 * rate, but nowhere near good enough for the label that LEADS the Explore card.
 * Spending extra rounds on it does not help (tested: 20-23% regardless) and it
 * costs real accuracy on spice, richness and novelty.
 *
 * That is an information ceiling, not a tuning problem. So we stop fighting it:
 * cuisine is asked directly on a tile grid next to the diet-band gate.
 *
 * This is not a retreat — it is the point. Cuisine is the one food attribute
 * people report accurately about themselves; nobody is confused about whether
 * they eat South Indian. The quiz exists to measure the things self-report gets
 * WRONG: how much heat you actually want, how far you will stray from your
 * usual, how rich you like it. Everyone claims to love spicy food. The quiz is
 * what finds out.
 *
 * Quiz evidence still orders the cuisines a user ticked, and can promote an
 * unticked one they kept choosing.
 */
const DECLARED_CUISINE_BONUS = 0.5;

/**
 * Re-expresses a raw axis estimate as a position within what the user's own
 * diet band can actually express.
 *
 * The estimator averages the values of dishes the user CHOSE, so it can never
 * exceed the most extreme dish their pool contains. The veg pools top out lower
 * on spice than the non-veg ones (misal pav at 0.90 vs Kundapur ghee roast at
 * 0.95, and far fewer near the ceiling), so a vegan chilli fiend was landing
 * around 0.45 and reading as "Medium Spicy" while an identical meat-eater read
 * as "Extra Spicy". That is the app calling someone's tolerance wrong because of
 * what they don't eat.
 *
 * Rescaling against that spread fixes it: the estimate is stretched across the
 * range the band can actually express, so 0.9 means "near the top of what is on
 * your menu" and is comparable when two people are matched.
 *
 * Deliberately a CONTINUOUS rescale rather than a percentile rank. A rank
 * mapping is a step function, and these axes have large point masses — dozens of
 * savoury dishes sit at exactly sweetness 0.05. A float difference of 1e-16 in
 * the raw estimate then lands either side of that cliff and the output jumps by
 * 0.65, destroying the order-independence guarantee above.
 * The curve is the measured quantile distribution of the estimates a simulated
 * population actually produces in each band — see `calibrate-pool.ts`. Mapping
 * through it makes the output uniform, so 0.9 means "spicier than 90% of people
 * in your diet band" and each of the five card labels lands on a real share of
 * the population. The table also makes the cross-band gap visible: the vegan
 * pool tops out well below eats-anything on novelty, so an adventurous vegan was
 * structurally capped before this.
 *
 * These constants encode a UNIFORM synthetic prior over tastes. Regenerate them
 * from real quiz results once there is a live population — the whole point is
 * that the bands reflect who is actually on the app.
 */
interface Curve {
  values: number[];
  pcts: number[];
}
const curveCache = new Map<string, Curve>();

/**
 * Collapses repeated knot values to a single point at their MIDRANK.
 *
 * Some axes have a genuine point mass — roughly 40% of people end up with a
 * sweetness estimate of exactly 0.05, so nine consecutive knots share that
 * value. Interpolating across such a plateau reintroduces the cliff the
 * continuous rescale was meant to remove: raw = 0.05 exits at the bottom of the
 * run while raw = 0.05 + 1e-16 exits at the top, a jump of 0.5 from a rounding
 * difference. Assigning the whole tied group its average percentile (the
 * standard midrank treatment) makes the map continuous at the plateau, because
 * both sides now agree there.
 */
function curveFor(band: DietBand, axis: ContinuousAxis): Curve {
  const key = `${band}:${axis}`;
  let curve = curveCache.get(key);
  if (!curve) {
    const knots = POOL_CALIBRATION[band][axis];
    const last = knots.length - 1;
    const values: number[] = [];
    const pcts: number[] = [];
    let i = 0;
    while (i < knots.length) {
      let j = i;
      while (j + 1 < knots.length && knots[j + 1] === knots[i]) j++;
      values.push(knots[i]);
      pcts.push((i / last + j / last) / 2);
      i = j + 1;
    }
    curve = { values, pcts };
    curveCache.set(key, curve);
  }
  return curve;
}

function calibrateToPool(band: DietBand, axis: ContinuousAxis, raw: number): number {
  const { values, pcts } = curveFor(band, axis);
  const last = values.length - 1;
  if (last < 1) return raw;
  if (raw <= values[0]) return pcts[0];
  if (raw >= values[last]) return pcts[last];
  // Piecewise-linear inverse CDF. Continuous and monotone, so the
  // order-independence guarantee survives.
  for (let k = 0; k < last; k++) {
    if (raw <= values[k + 1]) {
      const within = (raw - values[k]) / (values[k + 1] - values[k]);
      return pcts[k] + within * (pcts[k + 1] - pcts[k]);
    }
  }
  return pcts[last];
}

/**
 * Axis estimates in RAW item space, before pool calibration.
 *
 * Pair selection and the representative-item picker both reason about actual
 * catalog values, so they must use these — comparing a calibrated percentile
 * against a raw dish value would silently mis-target every adaptive probe.
 */
export function rawAxisEstimates(acc: TasteAccumulator): Record<ContinuousAxis, number> {
  return Object.fromEntries(
    CONTINUOUS_AXES.map((a) => [a, acc.den[a] > 0 ? acc.num[a] / acc.den[a] : 0.5]),
  ) as Record<ContinuousAxis, number>;
}

export function finalise(acc: TasteAccumulator): TasteVector {
  const raw = rawAxisEstimates(acc);
  const axes = Object.fromEntries(
    CONTINUOUS_AXES.map((a) => [a, calibrateToPool(acc.dietBand, a, raw[a])]),
  ) as Record<ContinuousAxis, number>;
  const axisConfidence = Object.fromEntries(
    CONTINUOUS_AXES.map((a) => [a, confidenceFrom(acc.den[a])]),
  ) as Record<ContinuousAxis, number>;

  // Declared cuisines set the shortlist; quiz evidence orders it.
  const direct = normalise<Cuisine>(acc.cuisine) as Record<string, number>;
  const blended: Record<string, number> = {};
  for (const c of new Set([...Object.keys(direct), ...acc.declaredCuisines])) {
    blended[c] =
      (direct[c] ?? 0) + (acc.declaredCuisines.includes(c as Cuisine) ? DECLARED_CUISINE_BONUS : 0);
  }

  return {
    dietBand: acc.dietBand,
    ...axes,
    cuisine: normalise<Cuisine>(blended),
    setting: normalise<Setting>(acc.setting),
    confidence: {
      ...axisConfidence,
      // Cuisine is now partly inferred from the axes, so it inherits their
      // confidence — but direct comparisons still count for more.
      // A declared cuisine is known, not estimated. Without a declaration this
      // falls back to quiz evidence alone, which the card treats as low-trust.
      cuisine:
        acc.declaredCuisines.length > 0 ? 1 : confidenceFrom(acc.cuisineEvidence * 0.5),
      setting: confidenceFrom(acc.settingEvidence * 0.5),
    },
  };
}

// ---------------------------------------------------------------- display

const SPICE_BANDS: Array<[number, string]> = [
  [0.2, 'Mild'],
  [0.38, 'Mildly Spicy'],
  [0.56, 'Medium Spicy'],
  [0.74, 'Spicy'],
  [1.01, 'Extra Spicy'],
];

export function spiceLabel(spice: number): string {
  return SPICE_BANDS.find(([ceiling]) => spice < ceiling)![1];
}

export function topCuisine(v: TasteVector): Cuisine | null {
  const entries = Object.entries(v.cuisine) as Array<[Cuisine, number]>;
  if (entries.length === 0) return null;
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

/**
 * The Explore card label, e.g. "North Indian, Extra Spicy".
 * Falls back gracefully when the quiz was abandoned early.
 */
export function foodIdentityLabel(v: TasteVector): string {
  const cuisine = topCuisine(v);
  const spice = spiceLabel(v.spice);
  if (!cuisine || v.confidence.cuisine < 0.4) return spice;
  return `${CUISINE_LABELS[cuisine]}, ${spice}`;
}

/** Short, human descriptors used for why-chips and the shareable result card. */
export function tasteTraits(v: TasteVector): string[] {
  const traits: string[] = [];
  if (v.confidence.novelty > 0.4) {
    if (v.novelty > 0.6) traits.push('orders the thing they cannot pronounce');
    else if (v.novelty < 0.3) traits.push('has a usual, and sticks to it');
  }
  if (v.confidence.richness > 0.4) {
    if (v.richness > 0.65) traits.push('believes butter is a food group');
    else if (v.richness < 0.35) traits.push('keeps it light');
  }
  if (v.confidence.sweetness > 0.4 && v.sweetness > 0.5) traits.push('dessert first');
  const setting = (Object.entries(v.setting) as Array<[Setting, number]>).sort(
    (a, b) => b[1] - a[1],
  )[0];
  if (setting && v.confidence.setting > 0.4) {
    const map: Record<Setting, string> = {
      street: 'street food over fine dining',
      home: 'home-cooked, every time',
      cafe: 'lives in cafés',
      restaurant: 'will book a table',
    };
    traits.push(map[setting[0]]);
  }
  return traits;
}
