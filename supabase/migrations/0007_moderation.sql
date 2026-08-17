-- SpiceSync — suspension.

alter table public.profiles
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text;

-- The feed asks for unsuspended people on every load.
create index if not exists profiles_active
  on public.profiles (city, onboarding_complete) where suspended_at is null;

/*
  Suspension is recorded here, but it is NOT what keeps a suspended person out.
  A row in this table cannot stop somebody signing in.

  The moderation action also bans the auth user, which is what actually revokes
  access — their refresh fails and every session dies. This column exists so the
  feed can exclude them without asking the auth service about every candidate,
  and so a human can see why and undo it.

  There is deliberately no policy letting anyone read it. A suspended person
  learns they are suspended by being unable to sign in, not by reading a flag.
*/
