import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server.ts';

/**
 * Signs someone in from an emailed link.
 *
 * The six-digit code is the intended path, but it only works if the Supabase
 * email template actually contains `{{ .Token }}` — and the default templates
 * send a link instead. Rather than depend on a dashboard setting being correct,
 * this handles the link too, so either style of template signs the user in.
 *
 * Both shapes Supabase can send are accepted: `?code=` (PKCE, the default for
 * the browser client) and `?token_hash=&type=` (what a template using
 * `{{ .TokenHash }}` produces). PKCE works here because @supabase/ssr keeps the
 * code verifier in a cookie, so the server can complete the exchange — it does
 * mean the link must be opened in the browser that requested it.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/after-signin';

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error('[auth/callback] code exchange failed', error.message);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error('[auth/callback] token_hash verify failed', error.message);
  }

  return NextResponse.redirect(`${origin}/auth?error=link`);
}
