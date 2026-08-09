/**
 * Verification for the match scorer.
 * Run: node --experimental-strip-types src/lib/match/verify-match.ts
 *
 * The quiz harness proves the estimator recovers a taste vector. This proves the
 * thing built on top of it behaves: that gates are absolute, that the score is
 * symmetric, that Explore is populated on launch day, and that no score ever
 * ships without a reason attached.
 */
import { getItem } from '../food/food-catalog.ts';
import { DEFAULT_ROUNDS, mulberry32, nextPair, representativeItem } from '../food/pair-generator.ts';
import { applyChoice, createAccumulator, finalise } from '../food/score-taste.ts';
import { CONTINUOUS_AXES, DIET_BAND_ORDER, type ContinuousAxis, type Cuisine, type FoodItem } from '../food/types.ts';
import { PSYCH_BANK, scorePsych, type PsychAnswer } from '../psych/psych-bank.ts';
import {
  BANNER_THRESHOLD,
  MIN_POOL_FOR_SCORES,
  gateFor,
  rankFor,
  scorePair,
} from './score.ts';
import type { Intent, MatchProfile } from './types.ts';

let failures = 0;
function check(name: string, pass: boolean, detail: string) {
  if (!pass) failures++;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
}

const CUISINES: Cuisine[] = [
  'north_indian', 'south_indian', 'bengali_east', 'west_indian',
  'mughlai', 'indo_chinese', 'continental', 'pan_asian', 'street',
];

/** Builds a real profile by actually running the quiz and the psych bank. */
function makeProfile(id: string, seed: number, over: Partial<MatchProfile> = {}): MatchProfile {
  const rng = mulberry32(seed);
  const band = DIET_BAND_ORDER[Math.floor(rng() * DIET_BAND_ORDER.length)];
  const fav = CUISINES[Math.floor(rng() * CUISINES.length)];
  const ideal = {
    spice: rng(), richness: rng(), novelty: rng(), sweetness: rng() * 0.7,
  } as Record<ContinuousAxis, number>;

  const acc = createAccumulator(band, [fav]);
  const util = (it: FoodItem) =>
    CONTINUOUS_AXES.reduce((s, a) => s - (it[a] - ideal[a]) ** 2, 0) + (it.cuisine === fav ? 0.35 : 0);
  for (let round = 1; round <= DEFAULT_ROUNDS; round++) {
    const pair = nextPair(acc, round, rng);
    if (!pair) break;
    const pa = 1 / (1 + Math.exp(-6 * (util(pair.left) - util(pair.right))));
    const winner = rng() < pa ? pair.left : pair.right;
    const loser = winner.id === pair.left.id ? pair.right : pair.left;
    applyChoice(acc, { round, winnerId: winner.id, loserId: loser.id, probing: pair.probing }, winner, loser);
  }

  const answers: PsychAnswer[] = PSYCH_BANK.filter((q) => q.tier === 'core').map((q) => ({
    questionId: q.id,
    optionId: q.options[Math.floor(rng() * q.options.length)].id,
  }));

  const gender = rng() < 0.5 ? 'man' : 'woman';
  return {
    id,
    age: 24 + Math.floor(rng() * 12),
    gender,
    seeking: [gender === 'man' ? 'woman' : 'man'],
    ageMin: 21,
    ageMax: 40,
    city: 'bangalore',
    intents: ['long_term'],
    openToDistance: false,
    taste: finalise(acc),
    representativeDish: representativeItem(acc, getItem)?.name,
    psych: scorePsych(answers),
    nonNegotiables: [],
    attributes: [],
    ...over,
  };
}

console.log('\n1. GATES ARE ABSOLUTE');
{
  const a = makeProfile('a', 1, { gender: 'man', seeking: ['woman'], age: 30 });
  const b = makeProfile('b', 2, { gender: 'woman', seeking: ['man'], age: 29 });
  check('a compatible pair passes', gateFor(a, b) === null, 'no gate triggered');
  check('self is excluded', gateFor(a, a) === 'self', 'cannot match yourself');

  const wrongGender = { ...b, seeking: ['woman'] };
  check('gender preference respected', gateFor(a, wrongGender) === 'gender', 'blocked');

  // FAIL CLOSED. An unanswered profile must match nobody, never everybody —
  // treating silence as "no preference" is what showed a woman a feed of women.
  check('no stated preference blocks, rather than matching everyone',
    gateFor({ ...a, seeking: [] }, b) === 'preferences_missing', 'blocked');
  check('the other side having no preference also blocks',
    gateFor(a, { ...b, seeking: [] }) === 'preferences_missing', 'blocked');
  check('missing gender blocks',
    gateFor({ ...a, gender: '' }, b) === 'preferences_missing', 'blocked');

  // Wanting must be mutual, not one-directional.
  const oneWay = { ...b, gender: 'woman', seeking: ['woman'] };
  check('one-sided interest is not a match', gateFor(a, oneWay) === 'gender',
    'a wants b, b does not want a');

  // The specific bug: nobody sees their own gender unless they asked to.
  const womenOnly = makeProfile('w', 3, { gender: 'woman', seeking: ['man'], age: 27 });
  const otherWomen = Array.from({ length: 10 }, (_, i) =>
    makeProfile(`ow${i}`, 900 + i, { gender: 'woman', seeking: ['man'] }),
  );
  const feed = rankFor(womenOnly, otherWomen);
  check('a woman seeking men sees no women', feed.matches.length === 0,
    `${feed.matches.length} shown out of ${otherWomen.length}`);

  const tooYoung = { ...b, age: 19 };
  check('age range respected', gateFor(a, tooYoung) === 'age', 'blocked');

  const marriageOnly = { ...b, intents: ['marriage'] as Intent[] };
  const casualOnly = { ...a, intents: ['casual'] as Intent[] };
  check('opposed intentions blocked', gateFor(casualOnly, marriageOnly) === 'intent', 'blocked');

  const exploring = { ...b, intents: ['exploring'] as Intent[] };
  check('exploring is a wildcard', gateFor(casualOnly, exploring) === null, 'undecided matches anyone');

  const smoker = { ...b, attributes: ['smokes'] };
  const nonSmoker = { ...a, nonNegotiables: ['smokes'] };
  check('dealbreakers block', gateFor(nonSmoker, smoker) === 'dealbreaker', 'blocked');
  check('dealbreakers block in reverse too', gateFor(smoker, nonSmoker) === 'dealbreaker', 'blocked');

  // The point of a gate: it cannot be outweighed.
  const perfectButSmokes: MatchProfile = {
    ...nonSmoker, id: 'x', gender: 'woman', seeking: ['man'], attributes: ['smokes'],
  };
  const { matches, blocked } = rankFor(nonSmoker, [perfectButSmokes]);
  check('an otherwise perfect match still blocked by a dealbreaker',
    matches.length === 0 && blocked[0]?.blocked === 'dealbreaker',
    'no amount of compatibility overrides a gate');
}

console.log('\n2. SYMMETRY');
{
  let worst = 0;
  for (let i = 0; i < 300; i++) {
    const a = makeProfile(`a${i}`, i * 13 + 1);
    const b = makeProfile(`b${i}`, i * 29 + 7);
    worst = Math.max(worst, Math.abs(scorePair(a, b).raw - scorePair(b, a).raw));
  }
  check('score(a,b) === score(b,a)', worst < 1e-12, `max difference ${worst.toExponential(2)}`);
}

console.log('\n3. IT RANKS THE RIGHT PEOPLE HIGHER');
{
  const base = makeProfile('me', 100, { gender: 'woman', seeking: ['man'], age: 28 });
  // A twin: same taste vector and same psych profile.
  const twin: MatchProfile = { ...base, id: 'twin', gender: 'man', seeking: ['woman'] };
  // An opposite: taste vector mirrored.
  const baseTopCuisine = (Object.entries(base.taste.cuisine) as Array<[Cuisine, number]>)
    .sort((x, y) => y[1] - x[1])[0][0];
  const otherCuisine = CUISINES.find((c) => c !== baseTopCuisine)!;
  const opposite: MatchProfile = {
    ...base, id: 'opp', gender: 'man', seeking: ['woman'],
    taste: {
      ...base.taste,
      spice: 1 - base.taste.spice,
      richness: 1 - base.taste.richness,
      novelty: 1 - base.taste.novelty,
      sweetness: 1 - base.taste.sweetness,
      // Mirror cuisine and setting too, or 0.35 of the food weight is a gift.
      cuisine: { [otherCuisine]: 1 } as Record<Cuisine, number>,
      setting: { restaurant: 1 } as Record<string, number> as typeof base.taste.setting,
      dietBand: base.taste.dietBand === 'vegan' ? 'eats_anything' : 'vegan',
    },
  };
  const twinScore = scorePair(base, twin).raw;
  const oppScore = scorePair(base, opposite).raw;
  check('a twin outscores an opposite', twinScore > oppScore + 0.15,
    `twin ${twinScore.toFixed(3)} vs opposite ${oppScore.toFixed(3)}`);

  const vegan = makeProfile('v', 5);
  vegan.taste = { ...vegan.taste, dietBand: 'vegan' };
  const carnivore = makeProfile('c', 6);
  carnivore.taste = { ...carnivore.taste, dietBand: 'eats_anything' };
  const veganPair = makeProfile('v2', 7);
  veganPair.taste = { ...veganPair.taste, dietBand: 'vegan' };
  check('vegan/vegan beats vegan/eats-anything',
    scorePair(vegan, veganPair).components.food > scorePair(vegan, carnivore).components.food,
    'diet distance is asymmetric but the pair score stays symmetric');
}

console.log('\n4. EMPTY PROFILES DO NOT MANUFACTURE AGREEMENT');
{
  const a = makeProfile('a', 11, { psych: scorePsych([]) });
  const b = makeProfile('b', 12, { psych: scorePsych([]) });
  const { components } = scorePair(a, b);
  check('two unanswered psych profiles score neutral, not high',
    Math.abs(components.psych - 0.5) < 0.01,
    `psych component ${components.psych.toFixed(3)} (silence is not agreement)`);
}

console.log('\n5. COLD START — Explore must not be empty on launch day');
{
  for (const size of [4, 12, 50, 200]) {
    const pool = Array.from({ length: size }, (_, i) =>
      makeProfile(`p${i}`, i * 977 + 13, { gender: 'man', seeking: ['woman'] }),
    );
    const me = makeProfile('me', 4242, { gender: 'woman', seeking: ['man'], age: 28, ageMin: 21, ageMax: 45 });
    const { matches, poolSize } = rankFor(me, pool);
    const top = matches[0];
    check(
      `pool of ${size}`,
      matches.length > 0,
      `${matches.length} shown · top displays ${top?.displayScore ?? '-'} · numbers ${top?.showScore ? 'shown' : 'hidden'} (pool ${poolSize})`,
    );
  }

  // The specific failure the design guards against.
  const tinyPool = Array.from({ length: 6 }, (_, i) =>
    makeProfile(`t${i}`, i * 31 + 3, { gender: 'man', seeking: ['woman'] }),
  );
  const me = makeProfile('me2', 99, { gender: 'woman', seeking: ['man'], age: 28, ageMin: 21, ageMax: 45 });
  const tiny = rankFor(me, tinyPool);
  check('a thin pool hides the percentage rather than inventing one',
    tiny.matches.every((m) => !m.showScore),
    `pool of ${tiny.poolSize} < ${MIN_POOL_FOR_SCORES}, so no numbers rendered`);
  check('a thin pool never fires the banner',
    tiny.matches.every((m) => !m.banner),
    '"you should try to meet" is not earned by being best of six');
}

console.log('\n6. NO SCORE WITHOUT A REASON');
{
  const pool = Array.from({ length: 60 }, (_, i) =>
    makeProfile(`p${i}`, i * 401 + 5, { gender: 'man', seeking: ['woman'] }),
  );
  const me = makeProfile('me', 7, { gender: 'woman', seeking: ['man'], age: 28, ageMin: 21, ageMax: 45 });
  const { matches } = rankFor(me, pool);
  const numbered = matches.filter((m) => m.showScore);
  const bare = numbered.filter((m) => m.chips.length === 0);
  check('no card ever shows a number without a reason', bare.length === 0,
    `${numbered.length} of ${matches.length} show a score, all explained`);

  const strong = matches.filter((m) => m.displayScore >= 70 && m.showScore);
  check('strong matches carry at least 2 chips', strong.every((m) => m.chips.length >= 2),
    `${strong.length} matches at 70+`);

  const unexplained = matches.filter((m) => m.chips.length === 0);
  check('unexplainable matches are still shown, just without a score',
    unexplained.every((m) => !m.showScore && !m.banner),
    `${unexplained.length} shown without a number rather than hidden`);

  const bannered = matches.filter((m) => m.banner);
  check('banner requires genuine compatibility, not just rank',
    bannered.every((m) => m.raw >= 0.62 && m.displayScore >= BANNER_THRESHOLD),
    `${bannered.length} of ${matches.length} earned the banner`);
}

console.log('\n7. DISTANCE FOLLOWS THE BRIEF\'S CHECKBOX');
{
  const me = makeProfile('me', 21, { city: 'bangalore', openToDistance: true, gender: 'woman', seeking: ['man'], ageMin: 21, ageMax: 45 });
  const farOptedIn = makeProfile('far1', 22, { city: 'delhi', openToDistance: true, gender: 'man', seeking: ['woman'] });
  const farOptedOut = makeProfile('far2', 23, { city: 'delhi', openToDistance: false, gender: 'man', seeking: ['woman'] });

  const optOut = rankFor(me, [farOptedOut]);
  check('someone far who did not opt in is hidden',
    optOut.matches.length === 0 && optOut.blocked.some((b) => b.blocked === 'distance'),
    'both sides must opt in');

  const optIn = rankFor(me, [farOptedIn]);
  const surfaced = optIn.matches.length === 1;
  check('someone far who opted in appears only on a strong score',
    surfaced ? optIn.matches[0].displayScore >= 78 : optIn.blocked.some((b) => b.blocked === 'distance'),
    surfaced ? `surfaced at ${optIn.matches[0].displayScore}` : 'held back — score below the distance floor');
}

console.log('\n8. SAMPLE FEED');
{
  const pool = Array.from({ length: 80 }, (_, i) =>
    makeProfile(`p${i}`, i * 613 + 11, { gender: 'man', seeking: ['woman'] }),
  );
  const me = makeProfile('me', 2026, { gender: 'woman', seeking: ['man'], age: 28, ageMin: 22, ageMax: 38 });
  const { matches, blocked } = rankFor(me, pool);
  console.log(`  ${matches.length} shown, ${blocked.length} filtered out`);
  for (const m of matches.slice(0, 4)) {
    console.log(`  ${m.displayScore}%${m.banner ? '  ★ you should try to meet' : ''}`);
    console.log(`     food ${m.components.food.toFixed(2)} · psych ${m.components.psych.toFixed(2)} · profile ${m.components.profile.toFixed(2)}`);
    console.log(`     ${m.chips.join(' · ')}`);
  }
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
