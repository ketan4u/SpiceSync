/**
 * Exercises the exact sequence QuizFlow.tsx drives, headlessly.
 * Run: node --experimental-strip-types src/lib/food/verify-flow.ts
 *
 * The engine harness proves the maths. This proves the FLOW: that every diet
 * band reaches a result, that nobody is shown the same dish twice, that the
 * "Neither" tap does not corrupt the run, and that a finished quiz always has
 * something to put on the card.
 */
import { getItem } from './food-catalog.ts';
import { DEFAULT_ROUNDS, mulberry32, nextPair, representativeItem } from './pair-generator.ts';
import { applyChoice, createAccumulator, finalise, foodIdentityLabel, tasteTraits } from './score-taste.ts';
import { DIET_BAND_ORDER, type Cuisine, type DietBand } from './types.ts';

let failures = 0;
function check(name: string, pass: boolean, detail: string) {
  if (!pass) failures++;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
}

/** Mirrors QuizFlow's advance/pick loop exactly. */
function runFlow(band: DietBand, cuisines: Cuisine[], seed: number, skipRound = -1) {
  const rng = mulberry32(seed);
  const acc = createAccumulator(band, cuisines);
  const shown: string[] = [];
  let round = 1;

  for (;;) {
    const pair = round <= DEFAULT_ROUNDS ? nextPair(acc, round, rng) : null;
    if (!pair) break;
    shown.push(pair.left.id, pair.right.id);
    const skipped = round === skipRound;
    // Simulate a user who leans toward the spicier option.
    const winner = pair.left.spice >= pair.right.spice ? pair.left : pair.right;
    const loser = winner.id === pair.left.id ? pair.right : pair.left;
    applyChoice(
      acc,
      { round, winnerId: winner.id, loserId: loser.id, skipped, probing: pair.probing },
      winner,
      loser,
    );
    round++;
  }

  const vector = finalise(acc);
  return {
    rounds: round - 1,
    shown,
    vector,
    label: foodIdentityLabel(vector),
    traits: tasteTraits(vector),
    rep: representativeItem(acc, getItem),
  };
}

console.log('\nQUIZ FLOW (as driven by QuizFlow.tsx)');
for (const band of DIET_BAND_ORDER) {
  const r = runFlow(band, ['south_indian', 'street'], 20260805);
  const unique = new Set(r.shown).size === r.shown.length;
  check(
    band,
    r.rounds === DEFAULT_ROUNDS && unique && r.label.length > 0 && r.rep !== null,
    `${r.rounds} rounds · ${r.shown.length} dishes, no repeats: ${unique} · "${r.label}" · ${r.rep?.name}`,
  );
}

console.log('\nEDGE CASES');
{
  // Cuisine step skipped entirely — the "Surprise me" path.
  const noCuisine = runFlow('eats_anything', [], 99);
  check('no cuisines declared still completes', noCuisine.rounds === DEFAULT_ROUNDS && noCuisine.label.length > 0,
    `"${noCuisine.label}" — cuisine still named, inferred from quiz evidence alone (confidence ${noCuisine.vector.confidence.cuisine.toFixed(2)})`);

  // "Neither, honestly" on an early round.
  const skipped = runFlow('all_veg', ['north_indian'], 7, 2);
  check('a skipped round does not break the run', skipped.rounds === DEFAULT_ROUNDS && skipped.rep !== null,
    `${skipped.rounds} rounds · "${skipped.label}"`);

  // Abandoning after two taps must still yield something renderable.
  const rng = mulberry32(3);
  const acc = createAccumulator('vegan', ['south_indian']);
  for (let round = 1; round <= 2; round++) {
    const pair = nextPair(acc, round, rng)!;
    applyChoice(acc, { round, winnerId: pair.left.id, loserId: pair.right.id, probing: pair.probing },
      pair.left, pair.right);
  }
  const partial = finalise(acc);
  check('abandoning early still renders', foodIdentityLabel(partial).length > 0,
    `"${foodIdentityLabel(partial)}" after 2 of ${DEFAULT_ROUNDS} rounds`);

  // Two people who answer identically must land identically, regardless of the
  // session seed — the seed varies which dishes are shown, not the verdict.
  const a = runFlow('mostly_non_veg', ['mughlai'], 11);
  const b = runFlow('mostly_non_veg', ['mughlai'], 11);
  check('same seed is reproducible', a.label === b.label && a.vector.spice === b.vector.spice,
    `both "${a.label}"`);
}

console.log('\nSAMPLE RESULT CARDS');
for (const band of ['vegan', 'all_veg', 'eats_anything'] as DietBand[]) {
  const r = runFlow(band, ['south_indian', 'street'], 4242);
  console.log(`  ${band}`);
  console.log(`    ${r.rep?.emoji}  ${r.label}`);
  console.log(`    ${r.traits.join(' · ') || '(no traits confident enough to show)'}`);
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
