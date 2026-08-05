/**
 * Verification harness for the Section 2 quiz engine.
 * Run: node --experimental-strip-types src/lib/food/verify-quiz.ts
 *
 * Checks, in order of how badly they would hurt if they failed:
 *   1. DIET GATE  — a vegan must never see egg or non-veg, in any round.
 *   2. RECOVERY   — simulated users with known tastes get vectors that correlate
 *                   with the truth. If this fails the quiz is decoration.
 *   3. ORDER      — the same set of choices in a different order yields the same
 *                   vector. This is what the original mechanic could not do.
 *   4. COVERAGE   — every diet band can complete a full 8 rounds.
 */
import { FOOD_CATALOG, getItem, poolFor } from './food-catalog.ts';
import { DEFAULT_ROUNDS, mulberry32, nextPair, representativeItem } from './pair-generator.ts';
import { applyChoice, createAccumulator, finalise, foodIdentityLabel, spiceLabel } from './score-taste.ts';
import { CONTINUOUS_AXES, DIET_BAND_ORDER, type ContinuousAxis, type Cuisine, type DietBand, type FoodItem } from './types.ts';

interface Persona {
  dietBand: DietBand;
  ideal: Record<ContinuousAxis, number>;
  /** The one they'd actually name if asked. */
  favouriteCuisine: Cuisine;
  /** What they tick on the grid: their favourite plus a couple they also eat. */
  declaredCuisines: Cuisine[];
}

/** Ticking the favourite plus 2 others they genuinely eat. */
function declare(favourite: Cuisine, rng: () => number): Cuisine[] {
  const others = CUISINES.filter((c) => c !== favourite).sort(() => rng() - 0.5).slice(0, 2);
  return [favourite, ...others];
}

const CUISINES: Cuisine[] = [
  'north_indian', 'south_indian', 'bengali_east', 'west_indian',
  'mughlai', 'indo_chinese', 'continental', 'pan_asian', 'street',
];

/** How much a persona likes an item. Squared distance on axes, plus a cuisine bump. */
function utility(item: FoodItem, p: Persona): number {
  let u = 0;
  for (const axis of CONTINUOUS_AXES) {
    u -= (item[axis] - p.ideal[axis]) ** 2;
  }
  if (item.cuisine === p.favouriteCuisine) u += 0.35;
  return u;
}

/** Logistic choice with realistic noise — humans are not perfect maximisers. */
function choose(a: FoodItem, b: FoodItem, p: Persona, rng: () => number): FoodItem {
  const beta = 6;
  const pa = 1 / (1 + Math.exp(-beta * (utility(a, p) - utility(b, p))));
  return rng() < pa ? a : b;
}

function runQuiz(p: Persona, seed: number) {
  const rng = mulberry32(seed);
  const acc = createAccumulator(p.dietBand, p.declaredCuisines);
  for (let round = 1; round <= DEFAULT_ROUNDS; round++) {
    const pair = nextPair(acc, round, rng);
    if (!pair) break;
    const winner = choose(pair.left, pair.right, p, rng);
    const loser = winner.id === pair.left.id ? pair.right : pair.left;
    applyChoice(acc, { round, winnerId: winner.id, loserId: loser.id, probing: pair.probing }, winner, loser);
  }
  return acc;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

let failures = 0;
function check(name: string, pass: boolean, detail: string) {
  const mark = pass ? 'PASS' : 'FAIL';
  if (!pass) failures++;
  console.log(`  [${mark}] ${name} — ${detail}`);
}

// ---------------------------------------------------------------- 1. diet gate
console.log('\n1. DIET GATE (safety-critical)');
{
  const rng = mulberry32(1);
  let violations = 0;
  let itemsShown = 0;
  for (const band of ['vegan', 'all_veg'] as DietBand[]) {
    const forbidden = band === 'vegan' ? ['vegetarian', 'egg', 'non_veg'] : ['egg', 'non_veg'];
    for (let trial = 0; trial < 300; trial++) {
      const fav = CUISINES[Math.floor(rng() * CUISINES.length)];
      const p: Persona = {
        dietBand: band,
        ideal: Object.fromEntries(CONTINUOUS_AXES.map((a) => [a, rng()])) as Record<ContinuousAxis, number>,
        favouriteCuisine: fav,
        declaredCuisines: declare(fav, rng),
      };
      const acc = createAccumulator(band, p.declaredCuisines);
      const r2 = mulberry32(trial * 7 + 3);
      for (let round = 1; round <= DEFAULT_ROUNDS; round++) {
        const pair = nextPair(acc, round, r2);
        if (!pair) break;
        itemsShown += 2;
        for (const item of [pair.left, pair.right]) {
          if (forbidden.includes(item.diet)) violations++;
        }
        const winner = choose(pair.left, pair.right, p, r2);
        const loser = winner.id === pair.left.id ? pair.right : pair.left;
        applyChoice(acc, { round, winnerId: winner.id, loserId: loser.id, probing: pair.probing }, winner, loser);
      }
    }
  }
  check('no forbidden item ever shown', violations === 0, `${violations} violations across ${itemsShown} items shown`);
}

// ----------------------------------------------------------------- 2. recovery
console.log('\n2. TASTE RECOVERY (1000 synthetic users)');
{
  const rng = mulberry32(42);
  const truth: Record<ContinuousAxis, number[]> = { spice: [], richness: [], novelty: [], sweetness: [] };
  const got: Record<ContinuousAxis, number[]> = { spice: [], richness: [], novelty: [], sweetness: [] };
  let cuisineHits = 0;
  let cuisineTop3 = 0;

  for (let i = 0; i < 1000; i++) {
    const recFav = CUISINES[Math.floor(rng() * CUISINES.length)];
    const p: Persona = {
      dietBand: DIET_BAND_ORDER[Math.floor(rng() * DIET_BAND_ORDER.length)],
      ideal: {
        spice: rng(),
        richness: rng(),
        novelty: rng(),
        // Most people are savoury-dominant; a pure uniform here is unrealistic.
        sweetness: rng() * 0.7,
      },
      favouriteCuisine: recFav,
      declaredCuisines: declare(recFav, rng),
    };
    const acc = runQuiz(p, i * 31 + 5);
    const v = finalise(acc);
    for (const axis of CONTINUOUS_AXES) {
      truth[axis].push(p.ideal[axis]);
      got[axis].push(v[axis]);
    }
    const ranked = (Object.entries(v.cuisine) as Array<[Cuisine, number]>).sort((a, b) => b[1] - a[1]);
    if (ranked[0]?.[0] === p.favouriteCuisine) cuisineHits++;
    if (ranked.slice(0, 3).some(([c]) => c === p.favouriteCuisine)) cuisineTop3++;
  }

  for (const axis of CONTINUOUS_AXES) {
    const r = pearson(truth[axis], got[axis]);
    // Spice and novelty are the axes the product actually depends on.
    const threshold = axis === 'sweetness' ? 0.2 : 0.4;
    check(`${axis} correlation`, r > threshold, `r = ${r.toFixed(3)} (need > ${threshold})`);
  }
  // Cuisine is declared on a tile grid, so the question is no longer "1 of 9"
  // but "which of the 3 you ticked leads the card" => 33% by chance.
  check('cuisine top-1 within declared set', cuisineHits / 1000 > 0.45, `${(cuisineHits / 10).toFixed(1)}% (chance = 33%)`);
  check('declared cuisine leads card', cuisineTop3 / 1000 > 0.95, `${(cuisineTop3 / 10).toFixed(1)}% ranked in top 3`);
}

// ------------------------------------------------------- 3. order independence
console.log('\n3. ORDER INDEPENDENCE');
{
  const rng = mulberry32(7);
  let maxDrift = 0;
  for (let i = 0; i < 200; i++) {
    const ordFav = CUISINES[Math.floor(rng() * CUISINES.length)];
    const p: Persona = {
      dietBand: DIET_BAND_ORDER[Math.floor(rng() * DIET_BAND_ORDER.length)],
      ideal: { spice: rng(), richness: rng(), novelty: rng(), sweetness: rng() * 0.7 },
      favouriteCuisine: ordFav,
      declaredCuisines: declare(ordFav, rng),
    };
    const acc = runQuiz(p, i * 13 + 11);
    const original = finalise(acc);

    const shuffled = [...acc.choices].sort(() => rng() - 0.5);
    const replay = createAccumulator(p.dietBand, p.declaredCuisines);
    for (const c of shuffled) {
      applyChoice(replay, c, getItem(c.winnerId), getItem(c.loserId));
    }
    const replayed = finalise(replay);
    for (const axis of CONTINUOUS_AXES) {
      maxDrift = Math.max(maxDrift, Math.abs(original[axis] - replayed[axis]));
    }
  }
  check('vector identical under reordering', maxDrift < 1e-9, `max drift = ${maxDrift.toExponential(2)}`);
}

// ----------------------------------------------------------------- 4. coverage
console.log('\n4. BAND COVERAGE');
{
  for (const band of DIET_BAND_ORDER) {
    const pool = poolFor(band);
    const rng = mulberry32(99);
    const p: Persona = {
      dietBand: band,
      ideal: { spice: 0.5, richness: 0.5, novelty: 0.5, sweetness: 0.3 },
      favouriteCuisine: 'south_indian',
      declaredCuisines: ['south_indian', 'north_indian', 'street'],
    };
    const acc = runQuiz(p, 1234);
    const completed = acc.choices.length;
    check(`${band}`, completed === DEFAULT_ROUNDS && pool.length >= 20,
      `${pool.length} items in pool, completed ${completed}/${DEFAULT_ROUNDS} rounds`);
  }
}

// ------------------------------------------------------- 5. label distribution
console.log('\n5. LABEL DISTRIBUTION (2000 users)');
{
  const rng = mulberry32(4242);
  const labels: Record<string, number> = {};
  const clamped: Record<string, number> = { spice: 0, richness: 0, novelty: 0, sweetness: 0 };
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const fav = CUISINES[Math.floor(rng() * CUISINES.length)];
    const p: Persona = {
      dietBand: DIET_BAND_ORDER[Math.floor(rng() * DIET_BAND_ORDER.length)],
      ideal: { spice: rng(), richness: rng(), novelty: rng(), sweetness: rng() * 0.7 },
      favouriteCuisine: fav,
      declaredCuisines: declare(fav, rng),
    };
    const v = finalise(runQuiz(p, i * 31 + 5));
    const label = spiceLabel(v.spice);
    labels[label] = (labels[label] ?? 0) + 1;
    for (const a of CONTINUOUS_AXES) if (v[a] <= 1e-9 || v[a] >= 1 - 1e-9) clamped[a]++;
  }
  // A card label that lands on 45% of people is not an identity, it is a default.
  const share = Object.values(labels).map((n) => n / N);
  const spread = Object.entries(labels).map(([k, n]) => `${k} ${(100 * n / N).toFixed(0)}%`).join(' · ');
  check('all 5 spice bands used', Object.keys(labels).length === 5, spread);
  check('no band dominates', Math.max(...share) < 0.4, `largest = ${(100 * Math.max(...share)).toFixed(1)}%`);
  const worstClamp = Math.max(...Object.values(clamped)) / N;
  check('axes not saturating', worstClamp < 0.05, `worst axis clamped on ${(100 * worstClamp).toFixed(1)}% of users`);
}

// ------------------------------------------------------------------- 6. sample
console.log('\n6. SAMPLE OUTPUTS');
{
  const samples: Array<[string, Persona]> = [
    ['Vegan, adventurous, hates heat', { dietBand: 'vegan', ideal: { spice: 0.1, richness: 0.3, novelty: 0.85, sweetness: 0.2 }, favouriteCuisine: 'pan_asian', declaredCuisines: ['pan_asian', 'street', 'continental'] }],
    ['All veg, chilli fiend', { dietBand: 'all_veg', ideal: { spice: 0.95, richness: 0.6, novelty: 0.3, sweetness: 0.1 }, favouriteCuisine: 'west_indian', declaredCuisines: ['west_indian', 'street', 'continental'] }],
    ['Eats anything, rich food', { dietBand: 'eats_anything', ideal: { spice: 0.6, richness: 0.9, novelty: 0.8, sweetness: 0.2 }, favouriteCuisine: 'mughlai', declaredCuisines: ['mughlai', 'street', 'continental'] }],
    ['Generally non-veg, comfort', { dietBand: 'generally_non_veg', ideal: { spice: 0.35, richness: 0.7, novelty: 0.1, sweetness: 0.3 }, favouriteCuisine: 'north_indian', declaredCuisines: ['north_indian', 'street', 'continental'] }],
  ];
  for (const [name, p] of samples) {
    const acc = runQuiz(p, 2024);
    const v = finalise(acc);
    const rep = representativeItem(acc, getItem);
    console.log(`  ${name}`);
    console.log(`    -> "${foodIdentityLabel(v)}"  ${rep ? `${rep.emoji} ${rep.name}` : ''}`);
    console.log(`       spice ${v.spice.toFixed(2)} · richness ${v.richness.toFixed(2)} · novelty ${v.novelty.toFixed(2)} · sweet ${v.sweetness.toFixed(2)}`);
  }
}

console.log(`\nCatalog: ${FOOD_CATALOG.length} items`);
console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
