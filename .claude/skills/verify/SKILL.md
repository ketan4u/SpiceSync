---
name: verify
description: Run and interpret SpiceSync's verification suites. Use before committing changes to the quiz engine, the food catalog, the psych bank, or the quiz flow — and whenever a check fails and its meaning is not obvious. Explains what each of the 78 checks protects and what a failure actually indicates.
---

# Verifying SpiceSync

```bash
npm run verify          # all four suites, 78 checks
npm run verify:quiz     # the estimator
npm run verify:flow     # the user journey
npm run verify:match    # the scorer
npm run verify:psych    # the question bank
```

These run under `node --experimental-strip-types` — no build, no test framework.
That is why relative imports inside `src/lib` carry explicit `.ts` extensions.

**Run these before every commit that touches `src/lib/` or `src/app/quiz/`.**
Every check here exists because something real broke during development. None are
decorative.

## What each suite protects

### `verify:quiz` — the estimator

| Check | Protects against |
|---|---|
| Diet gate | A vegan being shown an egg or non-veg dish. Safety-critical; must always be 0 violations. |
| Taste recovery | The quiz being decoration. Simulates 1000 users with known tastes; spice/richness/novelty must correlate above r=0.4. |
| Cuisine within declared set | The card label being wrong. Should sit near 53% against a 33% chance rate. |
| Order independence | The estimator becoming order-dependent. Must be bit-identical (drift < 1e-9). |
| Band coverage | A narrow diet band running out of dishes mid-quiz. |
| Label distribution | The card label going bimodal — no spice band may exceed 40% of users. |
| Axis saturation | Estimates clamping at 0 or 1 for more than 5% of users. |

### `verify:flow` — the journey `QuizFlow.tsx` actually drives

Every diet band completes 8 rounds · no dish shown twice · "Neither" does not
corrupt a run · skipping the cuisine step still completes · abandoning after two
taps still renders something · same seed reproduces.

### `verify:match` — the scorer

Gates are absolute and cannot be outweighed by a good score · `score(a,b)` equals
`score(b,a)` · a twin outranks an opposite · two unanswered psych profiles score
neutral rather than high · Explore is non-empty at pool sizes 4 through 200 ·
a thin pool hides the number instead of inventing one · every surfaced match
carries at least two chips · the distance opt-in behaves as the brief describes.

**Score symmetry fails.** Something in the scorer reads one side only. Asymmetric
preferences (diet tolerance) must be resolved with `min`, not by returning a
per-viewer number.

**Cold start fails.** The display blend or the pool thresholds changed. Explore
being empty on launch day is the specific failure this suite exists to prevent.

### `verify:psych` — the question bank

Structure (12 core, ids unique, 2–4 options, deltas in range) · trait coverage
proportional to weight · every high-weight trait reachable from the core 12 ·
scoring behaves (consistent answers produce a strong reading, no answers produce
neutral, chips need 2+ items) · length budget (core under 2 minutes).

## Reading a failure

**Order independence fails.** The estimator stopped being commutative. Almost
always a discontinuous mapping applied to the axis values — a step function, a
percentile rank, or a plateau in a lookup curve — where a 1e-16 float difference
falls off a cliff. This broke twice in development for exactly that reason. Any
transform applied to an axis estimate must be continuous and monotone. Do not
"fix" this by loosening the tolerance.

**Label distribution fails** (one spice band over 40%). The calibration constants
no longer match what the catalog can express. Run `npm run calibrate` and commit
the regenerated `pool-calibration.ts`. If it still fails afterwards, the catalog
itself has a gap — see the `add-dish` skill's coverage notes.

**Axis saturation fails.** Same cause. Calibrating against the spread of *dish
values* instead of the spread of *estimates* produces this; the constants must
come from `calibrate-pool.ts`, which simulates real quiz runs.

**Taste recovery drops.** Usually a newly added dish that is extreme on several
axes at once, which makes pairs unattributable. Check recent catalog changes for
a dish that is simultaneously very spicy, very rich and very novel.

**Diet gate fails.** Stop and fix immediately — do not commit. Either a dish is
misclassified in the catalog or `DIET_BAND_POOL` was widened. A vegan being shown
meat is the most damaging bug this product can ship.

**Band coverage fails.** A diet band dropped below the dishes it needs for 8
unique rounds. Add dishes to that band rather than shortening the quiz.

**Psych trait coverage fails.** A trait that moves the match score rests on too
few items. The bar scales with weight (3+ items at weight ≥0.6, otherwise 2+).
Add questions rather than lowering the weight, unless the trait genuinely
matters less than it was given credit for.

## What these checks do NOT prove

They validate the engine against *simulated* users whose tastes were defined by
the simulation. They show the estimator recovers what it claims to recover. They
say nothing about whether food preference predicts attraction — only real users
answer that. Do not cite these correlations as evidence the matching works.
