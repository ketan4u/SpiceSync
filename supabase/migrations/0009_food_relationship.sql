-- SpiceSync — Section 2b, and a badge that says something.

alter table public.profiles
  add column if not exists food_answers   jsonb not null default '[]'::jsonb,
  add column if not exists food_archetype text,
  add column if not exists food_weight    real;

/*
  WIPE. Read this before running it a second time.

  The taste vector's shape changed: `setting` is now stated rather than probed,
  and the vector carries an archetype and a per-person food weight. A vector
  captured before this migration has none of that, and the calibration constants
  it was scored against have been regenerated. Keeping the old ones would mean
  badges computed from stale distributions.

  Everyone therefore retakes Section 2. Section 3 answers are deliberately
  untouched — nothing about this change invalidates them, and they are the
  slower thing to re-earn.

  This is defensible today because two real profiles exist. The same statement a
  month from now would not be.
*/
update public.profiles
set taste               = null,
    food_label          = null,
    diet_band           = null,
    declared_cuisines   = '{}',
    representative_dish = null,
    food_answers        = '[]'::jsonb,
    food_archetype      = null,
    food_weight         = null;
