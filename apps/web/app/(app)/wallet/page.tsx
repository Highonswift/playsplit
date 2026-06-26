import { Wallet } from 'lucide-react';

export default function WalletPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Wallet</h1>
      <div className="card flex flex-col items-center gap-2 py-10 text-center text-[var(--muted)]">
        <Wallet size={28} />
        <p className="text-sm">Wallet ledger & payments arrive in milestone M5.</p>
      </div>
    </div>
  );
}
