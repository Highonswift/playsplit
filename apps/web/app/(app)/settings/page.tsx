import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
      <div className="card flex flex-col items-center gap-2 py-10 text-center text-[var(--muted)]">
        <Settings size={28} />
        <p className="text-sm">Group, pricing & cost-model settings arrive in milestone M7.</p>
      </div>
    </div>
  );
}
