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

All four values come from **Project Settings → API Keys**. Use the `anon` /
`publishable` key — never `service_role`.

The `NEXT_PUBLIC_` pair **is** sent to the browser, and has to be: Supabase Auth
runs client-side. That is safe only because row-level security decides what the
key's holder may do, which makes the policies in `supabase/migrations/` the
entire security boundary rather than a second line of defence. The app runs
without any of it — sign-in reports that it is not connected rather than failing
oddly.

Apply both migrations in the Supabase SQL Editor, in order.

**One Supabase setting is required for sign-in.** The default email template
sends a magic link; this app uses a six-digit code, because on a phone a link
bounces you out to a mail app and often back into a different browser without
the session. Go to **Authentication → Email Templates → Magic Link** and make
sure the body includes `{{ .Token }}`. Supabase's built-in mail service is also
rate-limited to a handful of messages per hour — fine for development, but
production needs your own SMTP.

Phone OTP is implemented behind `AUTH_PHONE_ENABLED`. Turning it on needs an SMS
provider **and** DLT registration with an Indian telecom operator; without that,
codes to Indian numbers are simply not delivered.

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
  pool.ts                SERVER ONLY — loads candidates, ranks, projects to cards
src/lib/supabase/admin.ts  SERVER ONLY — service-role client, bypasses RLS
  seed-profiles.ts       synthetic people for developing Explore — NOT users
src/lib/cities.ts      waitlist cities, shared by the form and the server action
src/lib/quiz-storage.ts  the quiz result and gender/seeking prefs, on the device
src/app/auth/          sign-in (email OTP live, phone built but flagged off)
src/app/onboarding/    the essentials, and the merge of device-held answers
src/lib/supabase/      browser and server clients
src/middleware.ts      session refresh and route gating
src/app/quiz/          the public, pre-signup quiz (Section 2)
src/app/questions/     the core 12 personality questions (Section 3)
src/app/explore/       the ranked feed, with questions dripped between cards
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

Both halves of the score are now live. With no Section 3 answers the
psychological component sits at a neutral 0.500 and only 11 of 16 cards can be
explained; after the core twelve it reaches ~0.72 and every card carries chips.

Accounts exist: email OTP sign-in, an 18+ gate enforced in the database as well
as the UI, and onboarding that carries the quiz result and personality answers
from the device into the profile.

Explore reads real accounts when you are signed in and onboarded, and falls back
to the seeded demo otherwise, so the public quiz still leads somewhere. Likes
persist, and a mutual like is a match.

Not built: messaging, moderation, and selfie *verification* — photos upload but
nothing checks them. The dealbreaker gate has nothing to act on because Section
1's non-negotiables are not collected yet. Dish art is emoji placeholder.

**How the feed reads other people.** There is deliberately no cross-user read
policy — through the ordinary client you can reach your own row and nothing
else. An earlier attempt at one recursed (its `USING` clause subqueried the
table it protected, which broke every write) *and* leaked every column, because
RLS is row-level.

Instead, ranking runs as trusted server code in `src/lib/match/pool.ts` using
the service-role client, which bypasses RLS. That is necessary because the
scorer is TypeScript and must read candidates' psych answers, which no user may
do. The containment is:

- Both files start with `import 'server-only'`, so reaching them from a client
  component is a build error.
- `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix and is never bundled.
  The build checks `.next/static` for it.
- Nothing leaves the server unprojected. `FeedCard` carries no psych answers and
  no date of birth — only a derived age.
- Photos are in a private bucket with no read policy; the server mints signed
  URLs that expire after 30 minutes.

Change either file the way you would change an auth check.
