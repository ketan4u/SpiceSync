-- SpiceSync — messages.

/**
 * Is the current user matched with `other`?
 *
 * SECURITY DEFINER because it has to see BOTH likes, and the likes policy
 * deliberately hides the other person's row — you cannot read who liked you.
 * Without this the message policies could never confirm a match.
 *
 * It takes only the other party and reads auth.uid() itself, rather than taking
 * two ids. A two-argument version would let any signed-in user ask whether two
 * arbitrary strangers are matched, which is nobody's business.
 */
create or replace function public.is_matched_with(other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.likes
      where liker_id = auth.uid() and liked_id = other and verdict = 'like'
    )
    and exists (
      select 1 from public.likes
      where liker_id = other and liked_id = auth.uid() and verdict = 'like'
    )
    and not exists (
      select 1 from public.blocks
      where (blocker_id = auth.uid() and blocked_id = other)
         or (blocker_id = other and blocked_id = auth.uid())
    );
$$;

revoke execute on function public.is_matched_with(uuid) from public, anon;
grant execute on function public.is_matched_with(uuid) to authenticated;

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body         text not null check (length(btrim(body)) between 1 and 2000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  constraint no_self_message check (sender_id <> recipient_id)
);

-- A thread is read from both ends, so index both orderings rather than relying
-- on a functional index over least()/greatest().
create index if not exists messages_sent
  on public.messages (sender_id, recipient_id, created_at);
create index if not exists messages_received
  on public.messages (recipient_id, sender_id, created_at);
create index if not exists messages_unread
  on public.messages (recipient_id) where read_at is null;

alter table public.messages enable row level security;

-- Sending requires a live match, checked in the database rather than trusted
-- from the client. Unmatching or blocking closes the door immediately.
drop policy if exists "send to a match" on public.messages;
create policy "send to a match"
  on public.messages for insert to authenticated
  with check (auth.uid() = sender_id and public.is_matched_with(recipient_id));

-- Reading requires the match to still exist, so unmatching or blocking takes
-- the conversation with it for both people. That is the behaviour every dating
-- app has, and the alternative — history that outlives the match — is a way to
-- keep talking at someone who has withdrawn.
drop policy if exists "read your own threads" on public.messages;
create policy "read your own threads"
  on public.messages for select to authenticated
  using (
    (auth.uid() = sender_id and public.is_matched_with(recipient_id))
    or (auth.uid() = recipient_id and public.is_matched_with(sender_id))
  );

-- The recipient may mark a message read. Nobody may edit a body: a message you
-- have already read must not be able to change underneath you.
drop policy if exists "mark received messages read" on public.messages;
create policy "mark received messages read"
  on public.messages for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Realtime delivery. Postgres Changes still applies the policies above, so a
-- subscriber only ever receives rows they could have selected.
-- Adding a table that is already published raises, so this stays re-runnable.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
