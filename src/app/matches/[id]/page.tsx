import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import AppHeader from '../../AppHeader.tsx';
import SafetyMenu from '../../SafetyMenu.tsx';
import Thread from './Thread.tsx';
import { getPartner, type Message } from '@/lib/match/thread.ts';
import { createClient } from '@/lib/supabase/server.ts';

export const metadata = { title: 'Conversation — SpiceSync' };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/auth?next=/matches/${id}`);
  if (auth.user.id === id) notFound();

  // The database decides whether these two are matched. Reading the messages
  // below would return nothing anyway under the select policy, but failing
  // here gives an honest page instead of an empty conversation.
  const { data: matched, error: rpcError } = await supabase.rpc('is_matched_with', { other: id });

  // A missing function and a genuine non-match are completely different
  // problems, and rendering both as "Not a match" sent someone to check a
  // relationship when the real answer was an unapplied migration.
  if (rpcError) {
    console.error('[thread] is_matched_with failed', rpcError.message);
    return (
      <main className="shell">
        <AppHeader />
        <h1>Messaging is not set up</h1>
        <p className="lede">
          The database is missing <code>is_matched_with</code>, so the server cannot confirm this
          match. Apply <code>supabase/migrations/0006_messages.sql</code>. Your match is fine —
          this is a setup gap.
        </p>
        <div className="spacer" />
        <Link href="/matches" className="btn" style={{ textDecoration: 'none' }}>
          Back to matches
        </Link>
      </main>
    );
  }

  if (!matched) {
    return (
      <main className="shell">
        <AppHeader />
        <h1>Not a match</h1>
        <p className="lede">
          You are not matched with this person, or one of you ended it. Conversations only exist
          while a match does.
        </p>
        <div className="spacer" />
        <Link href="/matches" className="btn" style={{ textDecoration: 'none' }}>
          Back to matches
        </Link>
      </main>
    );
  }

  const partner = await getPartner(id);
  if (!partner) notFound();

  const { data: rows } = await supabase
    .from('messages')
    .select('id,sender_id,body,created_at')
    .or(
      `and(sender_id.eq.${auth.user.id},recipient_id.eq.${id}),and(sender_id.eq.${id},recipient_id.eq.${auth.user.id})`,
    )
    .order('created_at', { ascending: true })
    .limit(200);

  const initial: Message[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    senderId: r.sender_id as string,
    body: r.body as string,
    createdAt: r.created_at as string,
  }));

  return (
    <main className="shell">
      <AppHeader />

      <div className="thread-head">
        <div className="match-photo">
          {partner.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partner.photoUrl} alt={partner.name} />
          ) : (
            <span aria-hidden>{partner.name.charAt(0)}</span>
          )}
        </div>
        <div>
          <div className="option-title">{partner.name}</div>
          {partner.foodLabel && <div className="option-sub">{partner.foodLabel}</div>}
        </div>
      </div>

      <Thread me={auth.user.id} partner={partner} initial={initial} />

      <SafetyMenu userId={partner.id} name={partner.name} canUnmatch />
    </main>
  );
}
