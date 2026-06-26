'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'phone' | 'email';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendOtp() {
    setError(null);
    setLoading(true);
    const { error } =
      mode === 'phone'
        ? await supabase.auth.signInWithOtp({ phone })
        : await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verify() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp(
      mode === 'phone'
        ? { phone, token: otp, type: 'sms' }
        : { email, token: otp, type: 'email' },
    );
    setLoading(false);
    if (error) setError(error.message);
    else router.push('/dashboard');
  }

  async function oauth(provider: 'google' | 'apple') {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <div className="card">
        <h1 className="text-2xl font-extrabold text-brand">PlaySplit</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Sign in to your sports group</p>

        <div className="mt-5 flex gap-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
          {(['phone', 'email'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setSent(false);
              }}
              className={`flex-1 rounded-lg py-2 capitalize ${
                mode === m ? 'bg-white shadow-sm' : 'text-[var(--muted)]'
              }`}
            >
              {m} OTP
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {!sent ? (
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
