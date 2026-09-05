'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client.ts';
import type { Message, ThreadPartner } from '@/lib/match/thread.ts';
import { markThreadRead, sendMessage } from '../actions.ts';

/**
 * One conversation, live.
 *
 * New messages arrive over Supabase Realtime rather than by polling. Postgres
 * Changes still applies the row policies, so a subscriber only ever receives
 * rows it could have selected — the filter below narrows what we ask for, it is
 * not what makes this safe.
 */
export default function Thread({
  me,
  partner,
  initial,
}: {
  me: string;
  partner: ThreadPartner;
  initial: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`thread:${partner.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${partner.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            sender_id: string;
            recipient_id: string;
            body: string;
            created_at: string;
          };
          if (row.recipient_id !== me) return;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, { id: row.id, senderId: row.sender_id, body: row.body, createdAt: row.created_at }],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, partner.id]);

  // Clearing the unread flag is a side effect on the server, not state here.
  useEffect(() => {
    void markThreadRead(partner.id);
  }, [partner.id, messages.length]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    const result = await sendMessage(partner.id, body);
    setSending(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not send.');
      return;
    }
    setDraft('');
    // The sender's own row does not come back over the subscription — the
    // filter listens for the partner. Reload so it appears exactly once.
    const supabase = createClient();
    const { data } = await supabase
      .from('messages')
      .select('id,sender_id,body,created_at')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${partner.id}),and(sender_id.eq.${partner.id},recipient_id.eq.${me})`)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages(
        data.map((r) => ({
          id: r.id as string,
          senderId: r.sender_id as string,
          body: r.body as string,
          createdAt: r.created_at as string,
        })),
      );
    }
  };

  return (
    <>
      {messages.length === 0 ? (
        <div className="thread-empty">
          <p>
            You matched. Nobody has said anything yet — and the food is right there as an opener.
          </p>
        </div>
      ) : (
        <div className="thread">
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.senderId === me ? 'mine' : 'theirs'}`}>
              {m.body}
            </div>
          ))}
          <div ref={bottom} />
        </div>
      )}

      {error && <p className="err">{error}</p>}

      {error && <p className="err" style={{ padding: '0 20px', margin: 0 }}>{error}</p>}

      <form className="composer" onSubmit={send} style={{ padding: '8px 16px 20px', borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
        <input
          className="text-input"
          placeholder={`Message ${partner.name}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          aria-label={`Message ${partner.name}`}
          style={{ marginBottom: 0, borderRadius: 20 }}
        />
        <button
          type="submit"
          disabled={sending || draft.trim().length === 0}
          style={{
            width: 44, height: 44, borderRadius: 22, flexShrink: 0,
            background: 'var(--accent)', border: 0, color: '#fff',
            fontSize: 18, fontWeight: 700, cursor: 'pointer',
            opacity: (sending || draft.trim().length === 0) ? 0.4 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label="Send message"
        >
          ↑
        </button>
      </form>
    </>
  );
}
