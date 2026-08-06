# SpiceSync

A dating app for India, built around food — and, underneath that, around a
psychological match. The original brief is in [`docs/brief.md`](docs/brief.md).

The bet: people cannot articulate what they want from dating, but they can tap a
photo of a dish. Section 2 turns eight taps into a taste vector; Section 3 turns
a dozen situational questions into a personality read; the match score weighs
both and — crucially — **explains itself** rather than emitting a bare number.

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in the two Supabase values
npm run dev                    # http://localhost:3000
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` come from your Supabase project's
**Project Settings → API Keys**. Use the `anon` / `publishable` key — never the
`service_role` one. Neither var is prefixed `NEXT_PUBLIC_`, so neither reaches
the browser. The app runs fine without them; the waitlist form just reports that
it is not connected instead of silently dropping signups.

Apply `supabase/migrations/0001_waitlist.sql` in the Supabase SQL Editor before
expecting signups to store.

## Verifying

```bash
npm run verify        # 42 checks across three suites
```

These run under `node --experimental-strip-types`, so there is no build step and
no test framework to install. That is also why relative imports inside `src/lib`
carry explicit `.ts` extensions — Node's ESM resolver requires them, and Next
resolves them too, so the app and the harnesses share one set of modules.

| Suite | What it protects |
|---|---|
| `verify:quiz` | The estimator. Taste recovery against 1000 synthetic users, the diet gate, order-independence, label distribution. |
| `verify:flow` | The user journey. Every diet band completes, no dish repeats, "Neither" is safe, abandoning early still renders. |
| `verify:psych` | The question bank. Trait coverage proportional to weight, scoring behaviour, length budget. |

Three of these exist because they each caught a real bug during development.
Please keep them green.

## Layout

```
src/lib/food/          the Section 2 engine
  food-catalog.ts        89 dishes, tagged along every axis the quiz measures
  pair-generator.ts      calibration + adaptive pair selection
  score-taste.ts         choices -> taste vector -> display label
  pool-calibration.ts    GENERATED — see below
  calibrate-pool.ts      regenerates the above
src/lib/psych/         the Section 3 bank (12 core + 22 drip situational items)
src/lib/cities.ts      waitlist cities, shared by the form and the server action
src/app/quiz/          the public, pre-signup quiz
src/app/r/             shareable result page (identity travels in the URL)
supabase/migrations/   schema
```

## Things worth knowing before you change them

**The quiz scores axes, not a winner.** The brief describes king-of-the-hill —
last dish standing is "your food". That is order-dependent and cannot produce the
`"North Indian, Extra Spicy"` label the card promises. The UI is unchanged; the
model underneath accumulates a 7-dimension vector. `verify:quiz` asserts the
result is bit-identical under reordering, so if you change the estimator, keep
it commutative.

**Cuisine is declared, not inferred.** Eight rounds identify 1-of-9 cuisines only
~22% of the time, and spending more rounds on it does not help while costing real
accuracy on spice/richness/novelty. So it is asked outright on a tile grid. This
is the right trade anyway: cuisine is the one food attribute people self-report
accurately. The quiz exists for what they get wrong — everyone claims to love
spicy food.

**`pool-calibration.ts` is generated, not written.** It maps raw estimates onto
the distribution each diet band can actually express, so a vegan who loves heat
can still read "Extra Spicy". Regenerate with `npm run calibrate` after changing
the catalog. The constants currently encode a *uniform synthetic prior* — once
there are real quiz results, regenerate from those instead.

**Match scores must never render bare.** Joel, Eastwick & Finkel (2017) found ML
over self-reported traits cannot predict pre-meeting compatibility above chance.
Every score ships with why-chips — "both extra-spicy", "no dealbreaker
conflicts". Explained reasons are defensible; an oracle is not.

**Rank by percentile, not an absolute threshold.** With a few hundred users
almost nobody clears an absolute 70%, and Explore renders empty on launch day.

## Status

Built: the Section 2 engine, the Section 3 bank, the public quiz, the shareable
result, the waitlist.

Not built: auth, onboarding, Explore, matching, chat, moderation. Dish art is
emoji placeholder pending real photography.
