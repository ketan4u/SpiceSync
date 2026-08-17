-- SpiceSync — non-negotiables.
--
-- Two lists, because the gate compares one person's non-negotiables against the
-- other's attributes in both directions. A non-negotiable with nothing declared
-- on the other side never fires, which is why both are collected.
--
-- The vocabulary is validated in the application (src/lib/dealbreakers.ts)
-- rather than by a CHECK constraint here: the list will grow, and a constraint
-- would turn every addition into a migration.

alter table public.profiles
  add column if not exists attributes      text[] not null default '{}',
  add column if not exists non_negotiables text[] not null default '{}';
