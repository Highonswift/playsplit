import Link from 'next/link';
import { Radio, Trophy, Wallet, CalendarCheck, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LivePill } from '@/components/ui';

const FEATURES = [
  { icon: Radio, title: 'Live cricket scoring', desc: 'Ball-by-ball scoring, real-time scorecards, multiple umpires.' },
  { icon: CalendarCheck, title: 'Matches & attendance', desc: 'Create matches in under 2 minutes, track who played.' },
  { icon: Trophy, title: 'Subscriptions & savings', desc: 'Prepaid ground hours with fair, transparent cost-sharing.' },
  { icon: Wallet, title: 'Wallets & payments', desc: 'Auto-settled dues, UPI/Razorpay, zero disputes.' },
];

export default function Landing() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-6">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <Link href="/login" className="btn-outline">
            Sign in
          </Link>
        </div>
      </header>

      <section className="mt-14 text-center sm:mt-24">
        <div className="mb-5 flex justify-center">
          <LivePill label="LIVE SCORING" />
        </div>
        <h1 className="mx-auto max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          The home for your{' '}
          <span className="text-primary">sports community</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
          Run matches, subscriptions and fair cost-sharing — and score cricket
          live, ball by ball, with real-time scorecards your whole team can follow.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login" className="btn shadow-pop">
            Get started <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <section className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="card flex items-start gap-3 transition hover:shadow-pop">
            <div className="rounded-xl bg-primary-soft p-2.5 text-primary-dark">
              <f.icon size={22} />
            </div>
            <div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <footer className="mt-16 border-t border-border pt-6 text-center text-sm text-subtle">
        PitchLive — live sports & cricket scoring
      </footer>
    </main>
  );
}
