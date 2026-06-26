import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
      <div className="card flex flex-col items-center gap-2 py-10 text-center text-[var(--muted)]">
        <BarChart3 size={28} />
        <p className="text-sm">Reports & analytics arrive in milestone M6.</p>
      </div>
    </div>
  );
}
