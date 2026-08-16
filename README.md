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

Apply every file in `supabase/migrations/` in the Supabase SQL Editor, in
filename order. Each one assumes the ones before it have run.

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
npm run verify        # 90 checks across four suites
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
  food-relationship.ts   Section 2b — what food MEANS to someone
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

**Section 2 has two halves, and they do different jobs.** The photo taps measure
*revealed* preference — everybody claims to love spicy food, and the taps find
out. The six questions in `food-relationship.ts` measure what taps cannot reach:
how central food is, what archetype someone is, and how much they need a partner
to share it. Neither replaces the other, and four questions from the original
draft were dropped precisely because they duplicated something already measured
better elsewhere.

**`setting` is stated, not probed.** Where someone eats is something people
report accurately, and three of the six questions speak to it directly. Dropping
it as a tap target did *not* measurably improve the other axes (spice recovery
0.729 → 0.727) — the adaptive selector rarely chose it anyway — so the taps
stayed at eight rounds rather than shrinking to six.

**Food is weighted per pair, not globally.** `WEIGHTS` used to be a fixed
0.4/0.4/0.2 for everyone, which over-weighted food for someone who told us it is
not a compatibility test and under-weighted it for someone for whom it is
everything. It now comes from the **average** of the two people's stated
importance, clamped so neither half can vanish. Averaging is what preserves
`score(a,b) === score(b,a)`; taking the stricter of the two would let one
person's priorities govern someone else's feed. A large gap between the two
becomes its own why-chip, because averaging alone would hide a real
incompatibility behind a decent number.

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

**Section 3 is optional, and optional means it costs you nothing but sharpness.**
Skipping it does not remove anyone from your feed: the gates are gender, age,
intent and dealbreakers, and an unanswered trait is treated as unknown rather
than as a filter. `verify:match` asserts that a profile with zero answers sees
the same people, in the same order, still carrying chips from food and intent —
so the feed can never quietly become a reward for finishing a personality test.
What you lose is the number, since a thin psychological read leaves less to
explain a score with, and a score with nothing behind it is not shown.

It fills in three ways, all of which now reach the profile: the twelve at
`/questions`, one question every fourth card in the feed, and the copy carried
from the device at signup. Answering in the feed rebuilds the deck, because the
answer changes the psychological half of every score below it and a feed that
kept its old order would be showing a ranking the app no longer believes.
Answers merge rather than overwrite, so no path deletes another's work.

Accounts exist: email OTP sign-in, an 18+ gate enforced in the database as well
as the UI, and onboarding that carries the quiz result and personality answers
from the device into the profile.

Explore reads real accounts when you are signed in and onboarded, and falls back
to the seeded demo otherwise, so the public quiz still leads somewhere. Likes
persist, and a mutual like is a match.

A pass can be undone **once per calendar day**, restoring the most recently
passed profile and showing them next. The allowance lives in the primary key of
`pass_undos`, and the undo itself is one Postgres function, so two taps in
flight cannot both succeed and nobody can spend an undo on a pass that turns out
not to exist. "Today" is IST — the app is India-first, and a UTC day would reset
at 05:30 where the users are.

That function is the single sanctioned exception to the rule that likes cannot
be deleted. It only ever removes the caller's own most recent pass.

Blocking, reporting and unmatching work. A block writes only to `blocks` — an
earlier version also stored a `pass`, which overwrote the blocker's existing
verdict and so destroyed a like permanently, making a reversible-sounding action
irreversible. The block table alone hides both people in both directions.

 A block hides both people from each
other — one-directional blocking is detectable by whoever is still being shown,
which is worse than none. Reporting blocks as a side effect and says so before
the tap. The blocked party cannot read the block: their RLS policy only matches
rows where they are the blocker, and the feed filter runs server-side.

`reports` has **no** select policy at all, not even for the reporter. Reading
rows back would be a way to probe whether someone has been reported, and nobody
can close a report they filed. Review the queue with the service-role key:

```sql
select * from reports where status = 'open' order by created_at desc;
```

Matches can talk. Messages arrive over Supabase Realtime, and the right to send
one is decided in the database: the insert policy calls `is_matched_with`, a
SECURITY DEFINER function needed because the likes policy deliberately hides who
liked you. A conversation exists only while the match does — unmatching or
blocking takes the history with it, for both people, which is what stops someone
carrying on at a person who has withdrawn.

`/settings` lets someone edit their profile, apply a retaken quiz, manage
blocks, and delete their account. Deletion is a real delete, not a flag: the
DPDP Act makes erasure a right, and profile, likes, blocks and messages all
cascade off `auth.users`. Storage objects do *not* cascade and are removed
explicitly first — a deleted account whose photos survive is the worst outcome
of pressing that button.

Retaking the quiz while signed in only updates the copy on the device, so
settings offers to apply it. Without that, someone could retake the quiz, see a
new food identity, and go on being matched on the old one indefinitely.

Signing in lands on `/after-signin`, which decides where you belong: an address
on the allowlist goes to moderation, a finished profile to Explore, anyone else
to onboarding. Only the server knows enough to make that call, and hardcoding
onboarding as the destination meant a moderator had to declare who they were
looking for before they could read a report.

`/admin` is the moderation queue. Access is an env allowlist — `ADMIN_EMAILS`,
comma separated — rather than a column, so there is nothing in the database to
escalate to and no code path in the app can grant it. Unset means nobody. Every
server action re-checks it, because a server action is a public endpoint and
guarding only the page would leave moderation one crafted request away from
anyone. A non-admin gets a 404, not a refusal, so nobody learns the page exists.

Suspending does two things and needs both: a column that takes the account out
of every feed, and an auth ban that actually revokes sign-in — a flag on a
profile row cannot stop somebody signing in. It is reversible, deliberately,
because you are acting on one person's account over another person's word.
Deleting an account is not available to moderators.

Non-negotiables are collected in onboarding (skippable) and editable in
settings, which makes the scorer's dealbreaker gate live. One vocabulary is read
two ways — "I smoke" and "won't date someone who smokes" — because a
non-negotiable is inert unless the other person declared the matching attribute.

**Caste, religion and complexion are deliberately not in that vocabulary**, and
`verify:match` asserts their absence so it cannot drift back in. Each would be
trivial to add and each is standard on Indian matrimonial platforms; that is the
reason to leave them out. A structured filter is not a neutral container — it is
what makes sorting people by those categories fast, repeatable and normal. It is
a product decision, not a technical limit. Overrule it knowingly.

Not built: selfie *verification* — photos upload but nothing checks them. Dish
art is emoji placeholder. Most of the brief's Section 1 — education, job,
height, prompts, red flags, political views, past-relationship learnings — is
still deferred, as is kundli matching and the settle-city question that goes
with a marriage intention.

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
