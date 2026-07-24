/** Minimal cricket icon (bat + ball) in the lucide stroke style. */
export function CricketIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* bat */}
      <path d="M4.5 19.5 L15 9" />
      <rect x="13.5" y="4.5" width="6.5" height="4.2" rx="1.4" transform="rotate(45 16.75 6.6)" />
      {/* ball */}
      <circle cx="6.5" cy="17.5" r="2.4" />
    </svg>
  );
}
