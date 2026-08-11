-- Fixes: "infinite recursion detected in policy for relation profiles".
--
-- 0002 added a policy letting members read other finished profiles, and its
-- USING clause ran a subquery against `profiles` itself. Evaluating the SELECT
-- policy therefore required a SELECT on the same table, which required
-- evaluating the policy again. Postgres aborts the loop, and every write took
-- the error with it — an upsert has to read the conflicting row, so onboarding
-- could not save at all.
--
-- The policy is removed rather than repaired. Two reasons:
--
--   1. Nothing reads other people's profiles yet. Explore still ranks seeded
--      profiles, so this policy grants access no code is asking for.
--
--   2. It was already flagged as unsafe. RLS is row-level, so "readable" meant
--      every column of those rows — including raw psych_answers and
--      date_of_birth. Shipping a policy that is both unused and over-permissive
--      is strictly worse than not having one.
--
-- When Explore reads real people, the access path should be a server-side view
-- that projects only display fields, with ranking done on the server. If a
-- policy like this is ever reinstated, the membership check must live in a
-- SECURITY DEFINER function so it bypasses RLS instead of re-entering it.

drop policy if exists "finished profiles readable by finished members" on public.profiles;

-- What remains: you can read, write, update and delete your own row, and
-- nothing else. That is everything the app currently needs.
