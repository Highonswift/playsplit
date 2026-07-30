'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

type Mode = 'password' | 'phone' | 'email';

export default function LoginPage() {
  const router = useRouter();
  // Construct the browser client lazily (never at render) so `next build` can
  // prerender this page without the NEXT_PUBLIC_* env vars present.
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const getSupabase = () => (clientRef.current ??= createClient());
  const [mode, setMode] = useState<Mode>('password');
  const [isSignUp, setIsSignUp] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Where to land after auth. Supports ?next=/join/<code> (invite links);
  // only internal paths are allowed, to avoid open redirects.
  const nextDest = () => {
    if (typeof window === 'undefined') return '/dashboard';
    const n = new URLSearchParams(window.location.search).get('next');
    return n && n.startsWith('/') && !n.startsWith('//') ? n : '/dashboard';
  };

  async function signInPassword() {
    setError(null);
    setLoading(true);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else router.push(nextDest());
  }

  async function signUpPassword() {
    setError(null);
    setInfo(null);
    if (fullName.trim().length < 2) return setError('Enter your name.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setLoading(true);
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setLoading(false);
    if (error) setError(error.message);
    else if (data.session) router.push(nextDest());
    else setInfo('Account created. Check your email to confirm, then sign in.');
  }

  async function sendOtp() {
    setError(null);
    setLoading(true);
    const { error } =
      mode === 'phone'
        ? await getSupabase().auth.signInWithOtp({ phone })
        : await getSupabase().auth.signInWithOtp({ email });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verify() {
    setError(null);
    setLoading(true);
    const { error } = await getSupabase().auth.verifyOtp(
      mode === 'phone'
        ? { phone, token: otp, type: 'sms' }
        : { email, token: otp, type: 'email' },
    );
    setLoading(false);
    if (error) setError(error.message);
    else router.push(nextDest());
  }

  async function oauth(provider: 'google' | 'apple') {
    await getSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <div className="mb-4 flex items-center justify-between">
        <Logo size={30} />
        <ThemeToggle compact />
      </div>
      <div className="card shadow-pop">
        <h1 className="font-display text-xl font-extrabold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to your sports community</p>

        <div className="mt-5 flex gap-2 rounded-xl bg-surface-2 p-1 text-sm font-medium">
          {(['password', 'phone', 'email'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setSent(false);
              }}
              className={`flex-1 rounded-lg py-2 capitalize ${
                mode === m ? 'bg-surface shadow-sm' : 'text-[var(--muted)]'
              }`}
            >
              {m === 'password' ? 'Password' : `${m} OTP`}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {mode === 'password' ? (
            <>
              {isSignUp && (
                <div>
                  <label className="label">Your name</label>
                  <input
                    className="input"
                    placeholder="Ravi Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  inputMode="email"
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (isSignUp ? signUpPassword() : signInPassword())}
                />
              </div>
              <button
                className="btn w-full"
                onClick={isSignUp ? signUpPassword : signInPassword}
                disabled={loading}
              >
                {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
              </button>
              {info && <p className="text-sm text-brand-dark">{info}</p>}
              <button
                className="w-full text-center text-sm text-[var(--muted)]"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setInfo(null);
                }}
              >
                {isSignUp ? 'Have an account? Sign in' : "New here? Create an account"}
              </button>
            </>
          ) : !sent ? (
            <>
              {mode === 'phone' ? (
                <div>
                  <label className="label">Phone number</label>
                  <input
                    className="input"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                  />
                </div>
              ) : (
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    inputMode="email"
                  />
                </div>
              )}
              <button className="btn w-full" onClick={sendOtp} disabled={loading}>
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="label">Enter the 6-digit code</label>
                <input
                  className="input tracking-[0.5em]"
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
              <button className="btn w-full" onClick={verify} disabled={loading}>
                {loading ? 'Verifying…' : 'Verify & continue'}
              </button>
              <button className="text-sm text-[var(--muted)]" onClick={() => setSent(false)}>
                ← Change {mode}
              </button>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="relative py-2 text-center">
            <span className="bg-[var(--card)] px-2 text-xs text-[var(--muted)]">or continue with</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-outline" onClick={() => oauth('google')}>
              Google
            </button>
            <button className="btn-outline" onClick={() => oauth('apple')}>
              Apple
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
