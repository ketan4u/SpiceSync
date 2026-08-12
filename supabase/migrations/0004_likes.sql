-- SpiceSync — likes, and the matches they imply.

create table if not exists public.likes (
  liker_id   uuid not null references auth.users(id) on delete cascade,
  liked_id   uuid not null references auth.users(id) on delete cascade,
  verdict    text not null check (verdict in ('like', 'pass')),
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id),
  constraint no_self_verdict check (liker_id <> liked_id)
);

-- The feed asks "who have I not judged yet" on every load.
create index if not exists likes_by_liker on public.likes (liker_id, created_at desc);
-- Reciprocity lookups go the other way.
create index if not exists likes_by_liked on public.likes (liked_id) where verdict = 'like';

alter table public.likes enable row level security;

-- You may record your own verdicts and read them back. Nothing here lets you
-- see who liked YOU: that would leak the other side of a pending like, which is
-- the one thing a dating app must not give away for free. Mutual likes are
-- resolved by trusted server code, which reveals a like only once it is
-- returned.
drop policy if exists "record own verdict" on public.likes;
create policy "record own verdict"
  on public.likes for insert to authenticated
  with check (auth.uid() = liker_id);

drop policy if exists "read own verdicts" on public.likes;
create policy "read own verdicts"
  on public.likes for select to authenticated
  using (auth.uid() = liker_id);

-- Changing your mind is allowed; deleting the record is not, so a pass cannot
-- be quietly retried to re-surface someone who passed on you.
drop policy if exists "update own verdict" on public.likes;
create policy "update own verdict"
  on public.likes for update to authenticated
  using (auth.uid() = liker_id) with check (auth.uid() = liker_id);
