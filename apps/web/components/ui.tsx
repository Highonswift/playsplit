import type { ReactNode } from 'react';

/* PitchLive reusable UI primitives (§3.2). Consumed across all screens. */

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'live';

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  primary: 'bg-primary-soft text-primary-dark',
  success: 'bg-emerald-500/15 text-success',
  warning: 'bg-amber-500/15 text-warning',
  danger: 'bg-red-500/15 text-danger',
  info: 'bg-blue-500/15 text-info',
  live: 'bg-red-500/15 text-live',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={`chip ${TONE[tone]} ${className ?? ''}`}>{children}</span>;
}

/** Animated "LIVE" indicator for in-progress matches. */
export function LivePill({ label = 'LIVE' }: { label?: string }) {
  return (
    <span className="chip bg-red-500/15 text-live">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
      </span>
      {label}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: React.ElementType;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 py-12 text-center">
      <div className="rounded-2xl bg-surface-2 p-3 text-muted">
        <Icon size={26} />
      </div>
      <p className="font-semibold">{title}</p>
      {hint && <p className="max-w-xs text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  tone?: 'good' | 'warn' | 'danger';
}) {
  const toneClass =
    tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warning' : tone === 'good' ? 'text-success' : '';
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {Icon && <Icon size={15} className="text-subtle" />}
      </div>
      <div className={`stat-value mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
