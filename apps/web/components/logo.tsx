/**
 * PitchLive logo (§2.1). The mark is a cricket-ball badge with a seam and a
 * "live" pulse dot. Uses theme variables so it works on light & dark, and a
 * `mono` variant for single-colour contexts.
 */
export function LogoMark({
  size = 32,
  mono = false,
  className,
}: {
  size?: number;
  mono?: boolean;
  className?: string;
}) {
  const bg = mono ? 'currentColor' : 'var(--primary)';
  const fg = mono ? 'var(--surface)' : 'var(--primary-contrast)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="11" fill={bg} />
      {/* ball outline */}
      <circle cx="19" cy="21" r="10.5" fill="none" stroke={fg} strokeWidth="2.4" opacity="0.95" />
      {/* seam */}
      <path
        d="M13.5 12.8 C 20 18, 20 24, 13.5 29.2"
        stroke={fg}
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      {/* stitches */}
      <g stroke={fg} strokeWidth="1.5" strokeLinecap="round" opacity="0.9">
        <path d="M14.8 16.4 L 12.6 17.2" />
        <path d="M16 20.9 L 13.7 21" />
        <path d="M14.9 25.4 L 12.7 24.8" />
      </g>
      {/* live pulse */}
      {!mono && <circle cx="31" cy="9" r="4.5" fill="var(--live)" stroke={bg} strokeWidth="2" />}
    </svg>
  );
}

export function Logo({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <LogoMark size={size} />
      <span className="font-display text-xl font-extrabold tracking-tight">
        Pitch<span className="text-primary">Live</span>
      </span>
    </span>
  );
}
