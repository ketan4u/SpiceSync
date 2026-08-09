import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps the auth session alive and gates the signed-in areas.
 *
 * Supabase access tokens are short-lived; without a refresh on each request the
 * session silently expires mid-session. `getUser()` is used rather than
 * `getSession()` because it revalidates the token with Supabase — session data
 * read straight from a cookie is attacker-controllable and must not be trusted
 * for an authorisation decision.
 */
const PROTECTED = ['/onboarding', '/me'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Without credentials the app still runs; the signed-in areas simply are not
  // reachable, which is better than crashing every request.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.some((p) => path.startsWith(p))) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = '/auth';
    signIn.searchParams.set('next', path);
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|api/og|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
