/** Instant skeleton shown while a page's server render is in flight.
 *  Turns a blank wait into an immediate, familiar layout. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <div className="h-7 w-40 rounded-lg bg-surface-2" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-16 rounded-2xl bg-surface-2" />
        <div className="h-16 rounded-2xl bg-surface-2" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card space-y-3">
          <div className="h-4 w-1/3 rounded bg-surface-2" />
          <div className="h-3 w-full rounded bg-surface-2" />
          <div className="h-3 w-4/5 rounded bg-surface-2" />
        </div>
      ))}
    </div>
  );
}
