import { commentaryLine, type InningsState } from '@playsplit/cricket';
import { MessageSquare } from 'lucide-react';

/** Auto-generated ball-by-ball commentary feed (§9.4). */
export function CommentaryFeed({
  state, names,
}: {
  state: InningsState; names: Record<string, string>;
}) {
  const lines = [...state.timeline]
    .map((e, i) => ({ i, e, text: commentaryLine(e, names) }))
    .slice(-15)
    .reverse();

  if (lines.length === 0) return null;

  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare size={16} className="text-muted" />
        <h2 className="font-semibold">Commentary</h2>
      </div>
      <ul className="space-y-1.5">
        {lines.map(({ i, e, text }) => {
          const wicket = !!e.wicketType;
          const boundary = !e.extra && (e.runsBat === 4 || e.runsBat === 6);
          return (
            <li
              key={i}
              className={`rounded-lg px-2 py-1 text-sm ${
                wicket ? 'bg-red-500/10 font-semibold text-danger' : boundary ? 'bg-primary-soft/50 font-medium' : ''
              }`}
            >
              {text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
