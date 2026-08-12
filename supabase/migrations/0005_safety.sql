-- SpiceSync — blocking and reporting.

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

-- The feed has to ask both "who have I blocked" and "who has blocked me", so
-- both directions need an index.
create index if not exists blocks_by_blocked on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- You may block, unblock, and see your own list.
--
-- Deliberately NOT readable by the person you blocked: their policy only
-- matches rows where they are the blocker. A block that the blocked party can
-- detect is worse than none, because it tells them they have been noticed.
-- Enforcement happens server-side, where the feed filters both directions.
drop policy if exists "create own block" on public.blocks;
create policy "create own block"
  on public.blocks for insert to authenticated
  with check (auth.uid() = blocker_id);

drop policy if exists "read own blocks" on public.blocks;
create policy "read own blocks"
  on public.blocks for select to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "remove own block" on public.blocks;
create policy "remove own block"
  on public.blocks for delete to authenticated
  using (auth.uid() = blocker_id);

-- ------------------------------------------------------------------ reports

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason      text not null check (reason in (
                'fake_profile', 'harassment', 'inappropriate_photos',
                'underage', 'spam_or_scam', 'other')),
  detail      text check (detail is null or length(detail) <= 2000),
  created_at  timestamptz not null default now(),
  status      text not null default 'open'
              check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  constraint no_self_report check (reporter_id <> reported_id)
);

create index if not exists reports_open_first on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- File a report and nothing else.
--
-- There is deliberately no select policy — not even for your own reports. A
-- reporter reading rows back is a way to confirm whether someone else has been
-- reported, and moderation is not a self-service surface. The queue is read
-- with the service-role key by whoever is doing the reviewing.
--
-- Nothing here updates `status` either: the person who filed a report must not
-- be able to close it.
drop policy if exists "file own report" on public.reports;
create policy "file own report"
  on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id);
