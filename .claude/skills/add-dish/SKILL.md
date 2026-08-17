---
name: add-dish
description: Add a dish to the SpiceSync food catalog, or retag an existing one. Use whenever someone wants a new food item in the Section 2 quiz, asks why a dish is scored the way it is, or changes any spice/richness/novelty/sweetness/diet/cuisine/setting tag. Covers the calibration conventions and the regeneration step that must follow.
---

# Adding a dish to the catalog

A dish is one line in `src/lib/food/food-catalog.ts`. There is no bracket to
update and no photo needed — the quiz builds its own pairs from tags, so a
correctly tagged dish immediately becomes usable in every diet band it belongs
to.

The tags are the whole product. A dish tagged carelessly does not just look
wrong, it drags every user who picks it toward a false reading.

## 1. Write the entry

```ts
{ id: 'kosha_mangsho', name: 'Kosha Mangsho', blurb: 'Cooked down for three hours',
  emoji: '🍖', diet: 'non_veg', cuisine: 'bengali_east',
  spice: 0.65, richness: 0.8, novelty: 0.5, sweetness: 0.05, setting: 'home' },
```

- `id` — snake_case, unique, stable. It is written into every stored quiz trail,
  so renaming an id orphans historical data. Add a new id rather than reusing one.
- `name` — what someone would actually call it out loud.
- `blurb` — one short line with a point of view. These carry the personality of
  the quiz while the art is still emoji. Not a description of ingredients.
- `emoji` — placeholder until real photography.

## 2. Classify the diet — this one is safety-critical

`diet` is not a score. It gates which pool the dish can appear in, and
`verify:quiz` asserts that a vegan is **never** shown an egg or non-veg item in
any round. Getting this wrong is the single most damaging mistake available here.

| Value | Means |
|---|---|
| `vegan` | No dairy, no ghee, no honey, no egg |
| `vegetarian` | Contains dairy or ghee. Indian convention: **excludes egg** |
| `egg` | Contains egg but no meat or fish |
| `non_veg` | Meat, fish, or seafood |

When unsure, classify **stricter**, not looser. Ghee is the usual trap — dal
tadka, most biryanis, and ghee roast dosa are `vegetarian`, not `vegan`.

## 3. Set the four axes

All are 0..1. Calibrate against dishes already in the catalog rather than in the
abstract — these anchors are real entries:

**spice** — 0 no heat, 1 extra spicy
```
0.05  White Sauce Pasta, Salmon Nigiri     0.50  Chole, Vada Pav, Ragi Mudde
0.25  Dosa, Lemon Rice, Poha               0.75  Schezwan Fried Rice, Donne Biryani
0.90+ Misal Pav, Chettinad Chicken, Kundapur Ghee Roast (0.95)
```

**richness** — 0 light and clean, 1 fried, creamy, heavy
```
0.15  Idli Sambar, Rasam Rice, Sundal      0.75  Donne Biryani, Pork Vindaloo
0.25  Sambar Rice, Upma, Bhel Puri         0.90+ Mysore Pak, Rabri Falooda, Nihari (0.95)
0.50  Medu Vada, Chole
```

**novelty** — 0 everyone in India has eaten it, 1 you have to seek it out.
**This is the most valuable axis in the quiz** — it tracks openness to
experience and is the bridge from Section 2 to Section 3. Judge it by *how many
people have eaten this*, not by how exotic it sounds to you.
```
0.05  Idli Sambar, Dosa, Rajma Chawal      0.70  Kathal Biryani, Nihari, Salmon Nigiri
0.25  Gobi 65, Penne Arrabbiata            1.00  Bheja Fry
0.50  Ragi Mudde, Akki Roti, Hummus
```

**sweetness** — 0 fully savoury, 1 dessert
```
0.05  most savoury dishes    0.20-0.35  Bhel Puri, Dhokla, Pani Puri, Filter Coffee
0.85+ Shrikhand, Nolen Gur Sandesh, Jalebi, Mysore Pak
```

`setting` is `street` | `home` | `cafe` | `restaurant` — where the dish actually
gets eaten. Note the quiz no longer *probes* this: a person's setting preference
comes from the Section 2b questions, which people answer accurately. The tag is
still used to pick the dish that represents someone, so keep it truthful.

## 4. Regenerate calibration, then verify

Adding a dish changes what each diet band's pool can express, so the calibration
constants are now stale:

```bash
npm run calibrate    # ~1 min; rewrites src/lib/food/pool-calibration.ts
npm run verify       # all 95 checks must stay green
```

Commit the regenerated `pool-calibration.ts` alongside the catalog change. It is
generated, never hand-edited.

## What good coverage looks like

Pairs are only informative when two dishes differ sharply on **one** axis and
barely on the others. A dish that is extreme on everything at once ("ghee roast
vs idli") teaches the estimator nothing, because the tap cannot be attributed.
So the catalog needs dishes that are *mid* on most axes and distinctive on one.

Current distribution — the thin spots are where new dishes help most:

- **diet**: vegan 42 · vegetarian 19 · egg 2 · non_veg 26
- **cuisine**: south_indian 24 · north_indian 14 · west_indian 11 · mughlai 10 ·
  continental 8 · pan_asian 7 · indo_chinese 6 · **street 5** · **bengali_east 4**
- **known gap**: almost nothing sits between sweetness 0.35 and 0.85, so
  mid-sweet dishes (halwa-adjacent, sweet chaat, payasam) are the highest-value
  additions right now.

Every diet band needs at least ~20 eligible dishes to fill 8 rounds without
repeats — `verify:quiz` checks this, and the vegan pool is the one that gets
tight first.
