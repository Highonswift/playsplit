import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff size={40} className="text-[var(--muted)]" />
      <h1 className="text-xl font-bold">You&apos;re offline</h1>
      <p className="max-w-xs text-sm text-[var(--muted)]">
        PlaySplit needs a connection to load this page. Your last-viewed pages stay available — try
        again once you&apos;re back online.
      </p>
    </main>
  );
}
