-- SpiceSync — accounts and profiles.
--
-- From here the anon key is exposed to the browser, because Supabase Auth runs
-- client-side. Row-level security is therefore the whole security boundary, not
-- a second line of defence. Every policy below is load-bearing.

create table if not exists public.profiles (
  -- Same id as the auth user, so a deleted account takes its profile with it.
  id                  uuid primary key references auth.users(id) on delete cascade,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  name                text not null,
  date_of_birth       date not null,
  gender              text not null,
  seeking             text[] not null default '{}',
  intents             text[] not null default '{}',
  city                text not null,
  open_to_distance    boolean not null default false,
  age_min             int not null default 21,
  age_max             int not null default 45,

  -- Section 2, carried over from the pre-signup quiz.
  diet_band           text,
  declared_cuisines   text[] not null default '{}',
  taste               jsonb,
  food_label          text,
  representative_dish text,

  -- Section 3. Raw answers, never exposed to other users — see the read policy.
  psych_answers       jsonb not null default '[]'::jsonb,

  photo_paths         text[] not null default '{}',

  -- Nobody enters the pool until they have finished. A half-built profile with
  -- an empty `seeking` would otherwise reach the scorer, which fails closed and
  -- would silently match them with nobody while looking fine to them.
  onboarding_complete boolean not null default false,

  constraint seeking_not_empty_when_complete
    check (not onboarding_complete or array_length(seeking, 1) >= 1),
  constraint intents_not_empty_when_complete
    check (not onboarding_complete or array_length(intents, 1) >= 1)
);

-- 18+, enforced in the database.
--
-- A CHECK constraint cannot reference current_date (it must be immutable, and a
-- row that was legal at insert would silently become illegal later), so this is
-- a trigger. It is not merely product policy: under the DPDP Act a minor's data
-- carries obligations we are not equipped to meet, so the safest place for this
-- rule is the layer no client can skip.
create or replace function public.enforce_adult()
returns trigger
language plpgsql
as $$
begin
  if new.date_of_birth > current_date - interval '18 years' then
    raise exception 'must be 18 or older';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_enforce_adult on public.profiles;
create trigger profiles_enforce_adult
  before insert or update on public.profiles
  for each row execute function public.enforce_adult();

alter table public.profiles enable row level security;

-- Your own row: full control.
drop policy if exists "own profile readable" on public.profiles;
create policy "own profile readable"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

drop policy if exists "own profile writable" on public.profiles;
create policy "own profile writable"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "own profile updatable" on public.profiles;
create policy "own profile updatable"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own profile deletable" on public.profiles;
create policy "own profile deletable"
  on public.profiles for delete to authenticated
  using (auth.uid() = id);

/*
  NO CROSS-USER READ POLICY, DELIBERATELY.

  You can reach your own row and nothing else. An earlier version of this file
  added a policy letting members read other finished profiles; it was removed in
  0003 for two reasons, both worth remembering before anyone adds it back.

  It recursed. The USING clause subqueried `profiles`, so evaluating the SELECT
  policy required a SELECT on the same table, and Postgres aborted the loop.
  Every write inherited the error, because an upsert reads the conflicting row.
  A membership check like that has to live in a SECURITY DEFINER function, which
  bypasses RLS rather than re-entering it.

  And it leaked. RLS is row-level, not column-level, so "readable" meant every
  column — including raw `psych_answers` and `date_of_birth`. When Explore needs
  real people, serve them from a server-side view that projects only the display
  fields, and rank on the server.
*/

create index if not exists profiles_pool_idx
  on public.profiles (city, onboarding_complete);

-- ------------------------------------------------------------------- photos

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Write only inside a folder named after your own user id.
drop policy if exists "own photos writable" on storage.objects;
create policy "own photos writable"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own photos removable" on storage.objects;
create policy "own photos removable"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Reading is left to signed URLs minted on the server, so there is no blanket
-- read policy here. A logged-in user cannot enumerate the bucket, and no photo
-- is reachable without the server deciding to hand out a link.
drop policy if exists "own photos readable" on storage.objects;
create policy "own photos readable"
  on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
