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

## Branches

**`develop` is the working branch — branch from it, and open PRs into it.**
`main` is the production branch and only moves by merging `develop`; Vercel
deploys `main` to the live site and gives every other branch its own preview URL.

```bash
git checkout develop
git pull
git checkout -b food/add-bengali-dishes    # or fix/…, quiz/…
# …work…
npm run verify && npm run lint             # both must be clean before you push
git push -u origin HEAD                    # then open a PR into develop
```

Keep branches small enough to review in one sitting. A PR that renames things
*and* changes the estimator is one nobody can check properly — and the estimator
is the part where a subtle change silently degrades everyone's results rather
than throwing an error.

Two things that must not reach `main` without a second look: any change to the
diet classification in the catalog (a vegan being shown meat is the worst bug
this product can ship), and any change to how axis estimates are transformed
(see the order-independence note below).

## Verifying

```bash
npm run verify        # 72 checks across four suites
npm run lint          # ESLint — must be clean
```

`react-hooks/exhaustive-deps` is set to **error**, not warning. A `useMemo`
missing a dependency shipped a blank Explore screen once: the build passed, all
four suites passed, and nothing threw. None of the harnesses cover React, so
this rule is the only thing standing between that class of bug and production.

These run under `node --experimental-strip-types`, so there is no build step and
no test framework to install. That is also why relative imports inside `src/lib`
carry explicit `.ts` extensions — Node's ESM resolver requires them, and Next
resolves them too, so the app and the harnesses share one set of modules.

| Suite | What it protects |
|---|---|
| `verify:quiz` | The estimator. Taste recovery against 1000 synthetic users, the diet gate, order-independence, label distribution. |
| `verify:flow` | The user journey. Every diet band completes, no dish repeats, "Neither" is safe, abandoning early still renders. |
| `verify:match` | The scorer. Gates are absolute, score is symmetric, Explore is non-empty at any pool size, no score ships without chips. |
| `verify:psych` | The question bank. Trait coverage proportional to weight, scoring behaviour, length budget. |

Each of these caught a real bug during development. Please keep them green.

## Layout

```
src/lib/food/          the Section 2 engine
  food-catalog.ts        89 dishes, tagged along every axis the quiz measures
  pair-generator.ts      calibration + adaptive pair selection
  score-taste.ts         choices -> taste vector -> display label
  pool-calibration.ts    GENERATED — see below
  calibrate-pool.ts      regenerates the above
src/lib/psych/         the Section 3 bank (12 core + 22 drip situational items)
src/lib/match/         the scorer
  score.ts               gates, weights, percentile ranking, why-chips
  types.ts               MatchProfile — what the scorer needs about a person
  seed-profiles.ts       synthetic people for developing Explore — NOT users
src/lib/cities.ts      waitlist cities, shared by the form and the server action
src/lib/quiz-storage.ts  the quiz result and gender/seeking prefs, on the device
src/app/quiz/          the public, pre-signup quiz
src/app/explore/       the ranked feed
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
The displayed number is a 50/50 blend of absolute compatibility and rank within
the available pool: pure absolute empties the feed at launch, pure percentile
crowns a "94% match" in a pool of four. Below 25 candidates no number is shown at
all, and the banner additionally requires genuine compatibility so that "you
should try to meet" is never earned by being the best of six.

**Gates are not tradeable.** Gender, age, intent and dealbreakers are boolean and
come before scoring. No amount of shared taste in food outweighs a dealbreaker,
and `verify:match` asserts exactly that.

**Silence is not agreement.** A trait neither person answered is skipped rather
than treated as "0.5 vs 0.5, perfectly similar" — otherwise two empty profiles
match at 90%.

**The gender gate fails closed.** A profile with no stated gender or no stated
`seeking` matches *nobody*, and is blocked as `preferences_missing` rather than
as an ordinary mismatch. Reading an empty list as "no preference" is tempting
because it makes a half-finished profile immediately useful — and it is exactly
what put women in a woman's feed during development. Interest must also be
mutual: A wanting B is not enough if B does not want A.

**A score never renders without a reason.** `showScore` is false when there are
no why-chips, so a card the scorer cannot explain is shown *without* a number
rather than with a bare one. Enforced in the scorer, not the card, so no future
screen can render around it.

## Status

Built: the Section 2 engine, the Section 3 bank, the match scorer, the public
quiz, the shareable result, the waitlist. Live at https://spice-sync.vercel.app

Explore runs against **seeded synthetic profiles**, labelled as such on screen.
They are generated by running the real quiz and the real psych bank, so the feed
exercises the actual estimator and scorer.

Not built: auth, onboarding, Section 3 in-app, chat, moderation. Dish art is
emoji placeholder pending real photography.
