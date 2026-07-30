/** Match-page skeleton: header + live scoreboard shape, shown instantly. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <div className="h-4 w-20 rounded bg-surface-2" />

      {/* Header card: two teams vs */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex flex-1 flex-col items-center gap-2">
            <div className="h-12 w-12 rounded-xl bg-surface-2" />
            <div className="h-3 w-16 rounded bg-surface-2" />
          </div>
          <div className="h-4 w-6 rounded bg-surface-2" />
          <div className="flex flex-1 flex-col items-center gap-2">
            <div className="h-12 w-12 rounded-xl bg-surface-2" />
            <div className="h-3 w-16 rounded bg-surface-2" />
          </div>
        </div>
      </div>

      {/* Scoreboard card */}
      <div className="card space-y-3">
        <div className="h-10 w-32 rounded bg-surface-2" />
        <div className="h-3 w-24 rounded bg-surface-2" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-8 rounded bg-surface-2" />
          <div className="h-8 rounded bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
