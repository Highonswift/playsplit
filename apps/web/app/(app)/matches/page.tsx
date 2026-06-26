import { CalendarDays } from 'lucide-react';

export default function MatchesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Matches</h1>
      <div className="card flex flex-col items-center gap-2 py-10 text-center text-[var(--muted)]">
        <CalendarDays size={28} />
        <p className="text-sm">Match creation, RSVP & attendance arrive in milestone M3.</p>
      </div>
    </div>
  );
}
