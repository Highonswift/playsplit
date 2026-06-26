import Link from 'next/link';
import { Trophy, Wallet, CalendarCheck, Users } from 'lucide-react';

const FEATURES = [
  { icon: CalendarCheck, title: 'Matches & attendance', desc: 'Create matches in under 2 minutes, track who played.' },
  { icon: Trophy, title: 'Subscription hours', desc: 'Track prepaid hours with dual hour/time expiry.' },
  { icon: Wallet, title: 'Fair cost-sharing', desc: 'Equal, usage, investor & hybrid models — auto-settled.' },
  { icon: Users, title: 'Wallets & payments', desc: 'Transparent wallets, UPI/Razorpay, zero disputes.' },
];

export default function Landing() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex items-center justify-between">
        <span className="text-xl font-extrabold text-brand">PlaySplit</span>
        <Link href="/login" className="btn-outline">
          Sign in
        </Link>
      </header>

      <section className="mt-12 text-center sm:mt-20">
        <h1 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          The operating system for community sports groups
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-[var(--muted)] sm:text-lg">
          Replace Excel sheets and WhatsApp reminders with transparent, automated
          subscription, attendance, and fair expense management.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login" className="btn">
            Get started
          </Link>
        </div>
      </section>

      <section className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="card flex items-start gap-3">
            <div className="rounded-xl bg-brand-light p-2.5 text-brand-dark">
              <f.icon size={22} />
            </div>
            <div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-[var(--muted)]">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
