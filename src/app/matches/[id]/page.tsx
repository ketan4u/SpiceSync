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
    <main className="shell" style={{ display: 'flex', flexDirection: 'column', padding: '0 0 0' }}>
      {/* Chat header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <Link href="/matches" style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, textDecoration: 'none', flexShrink: 0 }}>
          ‹
        </Link>
        <div className="match-photo" style={{ width: 40, height: 40, flexShrink: 0 }}>
          {partner.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partner.photoUrl} alt={partner.name} />
          ) : (
            <span aria-hidden style={{ fontSize: 18 }}>{partner.name.charAt(0)}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{partner.name}</div>
          {partner.foodLabel && <div style={{ fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{partner.foodLabel}</div>}
        </div>
        <SafetyMenu userId={partner.id} name={partner.name} canUnmatch />
      </div>

      <Thread me={auth.user.id} partner={partner} initial={initial} />
    </main>
  );
}
