-- SpiceSync — one undo a day.

create table if not exists public.pass_undos (
  user_id           uuid not null references auth.users(id) on delete cascade,
  -- Calendar day in IST. The app is India-first, so "today" should mean today
  -- where the user is, not a reset at 05:30 local because the server is on UTC.
  used_on           date not null,
  undone_profile_id uuid,
  created_at        timestamptz not null default now(),
  -- The allowance is enforced HERE. An application check could be raced by two
  -- taps in flight, and would be one refactor away from not existing.
  primary key (user_id, used_on)
);

alter table public.pass_undos enable row level security;

drop policy if exists "read own undos" on public.pass_undos;
create policy "read own undos"
  on public.pass_undos for select to authenticated
  using (auth.uid() = user_id);

/**
 * Undoes the most recent pass, once per calendar day.
 *
 * SECURITY DEFINER because it deletes from `likes`, and the likes policies do
 * not allow deletion — deliberately, so a pass cannot be quietly retried to
 * re-surface someone who passed on you. This function is the single sanctioned
 * exception, and it is narrow: it only ever removes the caller's own most
 * recent pass.
 *
 * The whole thing is one statement to the caller, so it is atomic. The
 * allowance row is inserted FIRST: if it violates the primary key the function
 * aborts and nothing is consumed, and if there turns out to be nothing to undo
 * the raise rolls the insert back. Neither order of failure can leave someone
 * having spent an undo for nothing.
 */
create or replace function public.undo_last_pass()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  today  date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  insert into public.pass_undos (user_id, used_on) values (auth.uid(), today);

  select liked_id into target
  from public.likes
  where liker_id = auth.uid() and verdict = 'pass'
  order by created_at desc
  limit 1;

  if target is null then
    raise exception 'nothing to undo';
  end if;

  delete from public.likes where liker_id = auth.uid() and liked_id = target;
  update public.pass_undos
     set undone_profile_id = target
   where user_id = auth.uid() and used_on = today;

  return target;
end;
$$;

revoke execute on function public.undo_last_pass() from public, anon;
grant execute on function public.undo_last_pass() to authenticated;
