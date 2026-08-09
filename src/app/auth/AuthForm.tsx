'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient, isConfigured } from '@/lib/supabase/client.ts';

/**
 * Sign in with a six-digit code.
 *
 * Email is the live path. Phone is implemented alongside it but off by default:
 * delivering SMS to Indian numbers requires DLT registration with a telecom
 * operator on top of an SMS provider, and until that clears the codes are not
 * delivered at all. Building it now means turning it on later is a config
 * change rather than a rewrite.
 *
 * A code rather than a magic link: on a phone, a link bounces you out to a mail
 * app and back, and often into a different browser without the session.
 */
type Method = 'email' | 'phone';
type Stage = 'identify' | 'code';

export default function AuthForm({ phoneEnabled, next }: { phoneEnabled: boolean; next: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('email');
  const [stage, setStage] = useState<Stage>('identify');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isConfigured()) {
    return (
      <>
        <h1>Sign-in is not connected</h1>
        <p className="lede">
          This build has no Supabase credentials, so accounts cannot be created. The quiz and
          Explore still work without one.
        </p>
      </>
    );
  }

  const supabase = createClient();

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } =
      method === 'email'
        ? await supabase.auth.signInWithOtp({ email: identifier.trim().toLowerCase() })
        : await supabase.auth.signInWithOtp({ phone: identifier.trim() });
    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStage('code');
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp(
      method === 'email'
        ? { email: identifier.trim().toLowerCase(), token: code.trim(), type: 'email' }
        : { phone: identifier.trim(), token: code.trim(), type: 'sms' },
    );
    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Server components must see the new cookie, so refresh rather than push.
    router.replace(next);
    router.refresh();
  };

  if (stage === 'code') {
    return (
      <>
        <p className="step-label">Step 2 of 2</p>
        <h1>Enter the code</h1>
        <p className="lede">We sent six digits to {identifier}. It expires in a few minutes.</p>

        <form onSubmit={verify} style={{ marginTop: 22 }}>
          <input
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            aria-label="Six-digit code"
            autoFocus
          />
          {error && <p className="err">{error}</p>}
          <button className="btn" type="submit" disabled={pending || code.length < 6}>
            {pending ? 'Checking…' : 'Continue'}
          </button>
        </form>

        <button
          className="btn-text"
          style={{ margin: '10px auto 0', display: 'block' }}
          onClick={() => { setStage('identify'); setCode(''); setError(null); }}
        >
          Use a different {method === 'email' ? 'address' : 'number'}
        </button>
      </>
    );
  }

  return (
    <>
      <p className="step-label">Step 1 of 2</p>
      <h1>Sign in</h1>
      <p className="lede">
        No password. We send a six-digit code and you are in.
      </p>

      {phoneEnabled && (
        <div className="tiles" style={{ marginTop: 20, marginBottom: 14 }}>
          {(['email', 'phone'] as Method[]).map((m) => (
            <button
              key={m}
              className="tile"
              data-selected={method === m}
              onClick={() => { setMethod(m); setIdentifier(''); setError(null); }}
              aria-pressed={method === m}
            >
              {m === 'email' ? 'Email' : 'Phone'}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={sendCode} style={{ marginTop: 18 }}>
        <input
          className="text-input"
          type={method === 'email' ? 'email' : 'tel'}
          required
          autoComplete={method === 'email' ? 'email' : 'tel'}
          placeholder={method === 'email' ? 'you@email.com' : '+91 98765 43210'}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          aria-label={method === 'email' ? 'Email address' : 'Phone number'}
        />
        {error && <p className="err">{error}</p>}
        <button className="btn" type="submit" disabled={pending || identifier.length < 3}>
          {pending ? 'Sending…' : 'Send me a code'}
        </button>
      </form>

      <p className="consent">
        By continuing you confirm you are 18 or older. We store your email, your quiz answers and
        your profile so we can match you, and you can delete all of it at any time.
      </p>
    </>
  );
}
