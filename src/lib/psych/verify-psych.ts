/**
 * Verification for the Section 3 bank.
 * Run: node --experimental-strip-types src/lib/psych/verify-psych.ts
 *
 * The thing that actually goes wrong with a question bank is uneven coverage:
 * a trait carrying real weight in the match score but touched by only one
 * item, so a single tap swings it. That is what this checks hardest.
 */
import {
  CORE_QUESTIONS,
  DRIP_QUESTIONS,
  PSYCH_BANK,
  TRAITS,
  psychChips,
  scorePsych,
  type PsychAnswer,
  type Trait,
} from './psych-bank.ts';

let failures = 0;
function check(name: string, pass: boolean, detail: string) {
  if (!pass) failures++;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
}

console.log('\n1. STRUCTURE');
{
  check('12 core questions', CORE_QUESTIONS.length === 12, `${CORE_QUESTIONS.length} core`);
  // The core set is fixed at twelve because that is the signup budget. The drip
  // set is sized by trait coverage instead — it grew past the original eighteen
  // to give night_owl, spending, pda and family_closeness enough to stand on.
  check('enough drip questions to cover the traits', DRIP_QUESTIONS.length >= 18,
    `${DRIP_QUESTIONS.length} drip, ${PSYCH_BANK.length} total`);

  const ids = PSYCH_BANK.map((q) => q.id);
  check('question ids unique', new Set(ids).size === ids.length, `${ids.length} questions`);

  const badOptions = PSYCH_BANK.filter((q) => {
    const optionIds = q.options.map((o) => o.id);
    return new Set(optionIds).size !== optionIds.length || q.options.length < 2 || q.options.length > 4;
  });
  check('every question has 2-4 unique options', badOptions.length === 0,
    badOptions.length ? badOptions.map((q) => q.id).join(', ') : 'all valid');

  const validTraits = new Set(Object.keys(TRAITS));
  const unknown = new Set<string>();
  const outOfRange: string[] = [];
  for (const q of PSYCH_BANK) {
    for (const o of q.options) {
      for (const [trait, delta] of Object.entries(o.scores)) {
        if (!validTraits.has(trait)) unknown.add(`${q.id}:${trait}`);
        if (delta < -1 || delta > 1) outOfRange.push(`${q.id}.${o.id}.${trait}=${delta}`);
      }
    }
  }
  check('all referenced traits exist', unknown.size === 0, unknown.size ? [...unknown].join(', ') : 'ok');
  check('all deltas within -1..1', outOfRange.length === 0, outOfRange.length ? outOfRange.join(', ') : 'ok');
}

console.log('\n2. TRAIT COVERAGE');
{
  const coreCount = {} as Record<Trait, number>;
  const allCount = {} as Record<Trait, number>;
  for (const trait of Object.keys(TRAITS) as Trait[]) {
    coreCount[trait] = 0;
    allCount[trait] = 0;
  }
  for (const q of PSYCH_BANK) {
    const touched = new Set<Trait>();
    for (const o of q.options) {
      for (const trait of Object.keys(o.scores) as Trait[]) touched.add(trait);
    }
    for (const trait of touched) {
      allCount[trait]++;
      if (q.tier === 'core') coreCount[trait]++;
    }
  }

  // Traits that move the score need more than one item behind them; a trait
  // resting on a single tap is noise dressed up as a signal. The bar scales
  // with influence — a trait weighted 1.0 can swing a match, one weighted 0.4
  // barely nudges it, so demanding equal evidence of both just pads the bank.
  const scoring = (Object.keys(TRAITS) as Trait[]).filter((t) => TRAITS[t].use !== 'context');
  const required = (t: Trait) => (TRAITS[t].weight >= 0.6 ? 3 : 2);
  const thin = scoring.filter((t) => allCount[t] < required(t));
  check('scoring traits have evidence proportional to weight', thin.length === 0,
    thin.length
      ? thin.map((t) => `${t}=${allCount[t]}/${required(t)}`).join(', ')
      : `${scoring.length} scoring traits all met their bar`);

  // Most users will only ever answer the core twelve.
  const heavy = scoring.filter((t) => TRAITS[t].weight >= 0.8);
  const uncoveredAtCore = heavy.filter((t) => coreCount[t] === 0);
  check('every high-weight trait is touched by the core 12', uncoveredAtCore.length === 0,
    uncoveredAtCore.length ? uncoveredAtCore.join(', ') : `${heavy.length} high-weight traits covered`);

  console.log('    coverage (core / total):');
  for (const trait of Object.keys(TRAITS) as Trait[]) {
    console.log(`      ${trait.padEnd(24)} ${String(coreCount[trait]).padStart(2)} / ${allCount[trait]}`);
  }
}

console.log('\n3. SCORING BEHAVIOUR');
{
  const empty = scorePsych([]);
  const allNeutral = (Object.keys(TRAITS) as Trait[]).every((t) => empty.traits[t] === 0.5);
  check('no answers => everything neutral', allNeutral, 'all traits 0.5, nothing to match on');

  const unknownAnswers: PsychAnswer[] = [{ questionId: 'nope', optionId: 'nope' }];
  check('unknown ids ignored', scorePsych(unknownAnswers).answered === 0, 'skipped cleanly');

  // A consistently anxious respondent should read anxious, not average out.
  const anxious: PsychAnswer[] = [
    { questionId: 'slow_reply', optionId: 'rereading' },
    { questionId: 'day_after_argument', optionId: 'urgent_fix' },
    { questionId: 'out_with_friends', optionId: 'left_out' },
    { questionId: 'read_no_reply', optionId: 'spiral' },
  ];
  const ap = scorePsych(anxious);
  check('consistent anxiety is detected', ap.traits.attachment_anxiety > 0.75,
    `attachment_anxiety = ${ap.traits.attachment_anxiety.toFixed(2)}`);

  const secure: PsychAnswer[] = [
    { questionId: 'slow_reply', optionId: 'unbothered' },
    { questionId: 'day_after_argument', optionId: 'resolved' },
    { questionId: 'out_with_friends', optionId: 'fine' },
    { questionId: 'read_no_reply', optionId: 'nothing' },
  ];
  const sp = scorePsych(secure);
  check('security is detected', sp.traits.attachment_anxiety < 0.25,
    `attachment_anxiety = ${sp.traits.attachment_anxiety.toFixed(2)}`);

  // Chips are the product surface — they must not fire on one thin data point.
  const oneAnswer = scorePsych([{ questionId: 'one_am', optionId: 'awake' }]);
  check('chips need 2+ items per trait', psychChips(oneAnswer).length === 0,
    'single answer produces no chips');

  const full = scorePsych([...anxious, ...secure.slice(0, 0), { questionId: 'ideal_sunday', optionId: 'alone' },
    { questionId: 'free_friday', optionId: 'protect' }]);
  console.log(`    sample chips: ${psychChips(full).join(' · ') || '(none)'}`);
}

console.log('\n4. LENGTH');
{
  // Roughly 7 seconds per situational item is the working assumption.
  const coreSeconds = CORE_QUESTIONS.length * 7;
  check('core set stays under 2 minutes', coreSeconds <= 120, `~${coreSeconds}s for ${CORE_QUESTIONS.length} items`);
  const words = PSYCH_BANK.reduce((sum, q) => sum + q.prompt.split(/\s+/).length, 0) / PSYCH_BANK.length;
  check('prompts stay short', words < 18, `mean ${words.toFixed(1)} words per prompt`);
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
