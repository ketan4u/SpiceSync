-- Fumble — pre-launch waitlist.
--
-- The whole point of a pre-signup quiz is that people arrive already scored, so
-- this stores the taste vector alongside the email. On launch day the Bangalore
-- pool is not a list of addresses, it is a set of profiles that can already be
-- ranked against each other — which is what stops Explore being empty.
--
-- The raw `choices` trail is kept deliberately: the calibration constants in
-- pool-calibration.ts are currently derived from a UNIFORM SYNTHETIC prior, and
-- regenerating them from real answers is what makes the five card labels reflect
-- who is actually on the app rather than who we imagined.

create table if not exists public.waitlist (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),

  email               text not null,
  city                text,

  -- Section 2 output
  diet_band           text not null,
  declared_cuisines   text[] not null default '{}',
  label               text,
  spice               real,
  richness            real,
  novelty             real,
  sweetness           real,
  cuisine_affinity    jsonb,
  setting_affinity    jsonb,
  confidence          jsonb,
  representative_dish text,

  -- Full A/B trail, for recalibrating the label bands from real data.
  choices             jsonb not null default '[]'::jsonb,

  source              text
);

-- One row per person. Case-insensitive: nobody thinks Ketan@x.com is a second
-- account from ketan@x.com.
create unique index if not exists waitlist_email_key
  on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- Anonymous visitors may ONLY insert. There is deliberately no select, update or
-- delete policy, so the anon key cannot read the list back, cannot enumerate
-- emails, and cannot tamper with rows. Reading happens from the dashboard or
-- with the service-role key, which never leaves the server.
drop policy if exists "anon can join waitlist" on public.waitlist;
create policy "anon can join waitlist"
  on public.waitlist
  for insert
  to anon
  with check (
    email is not null
    and length(email) between 3 and 320
    and position('@' in email) > 1
  );
