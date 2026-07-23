/**
 * ChannelLogo — bold visual marks for the three revenue channels shown
 * in the report dashboard (Turo, Parceiros, Particulares).
 *
 * Each mark is a self-contained SVG with its own gradient + glyph so it
 * stands out visually from a generic Lucide icon, while respecting the
 * admin private-bank tone (soft radii, layered gradients, no neon).
 */
type Props = { size?: number; className?: string };

export function TuroLogo({ size = 44, className }: Props) {
  return (
    <svg
      viewBox="0 0 44 44"
      width={size}
      height={size}
      className={className}
      aria-label="Turo"
      role="img"
    >
      <defs>
        <linearGradient id="turoBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0B3D2E" />
          <stop offset="100%" stopColor="#175E3D" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="12" fill="url(#turoBg)" />
      <text
        x="22"
        y="28.5"
        textAnchor="middle"
        fontFamily="'Poppins', system-ui, sans-serif"
        fontWeight={800}
        fontSize={15}
        letterSpacing={-0.4}
        fill="#7BE0A8"
      >
        turo
      </text>
      <circle cx="34" cy="12" r="2" fill="#7BE0A8" opacity="0.9" />
    </svg>
  );
}

export function ParceirosLogo({ size = 44, className }: Props) {
  return (
    <svg
      viewBox="0 0 44 44"
      width={size}
      height={size}
      className={className}
      aria-label="Parceiros"
      role="img"
    >
      <defs>
        <linearGradient id="parcBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.92" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="12" fill="url(#parcBg)" />
      {/* Two interlocking rings — partnership mark */}
      <circle cx="17.5" cy="22" r="7.5" fill="none" stroke="#1A1A1A" strokeWidth="2.2" />
      <circle cx="26.5" cy="22" r="7.5" fill="none" stroke="#1A1A1A" strokeWidth="2.2" />
      <path
        d="M20.2 16.5c1.1-.7 2.5-.7 3.6 0"
        stroke="#1A1A1A"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function ParticularesLogo({ size = 44, className }: Props) {
  return (
    <svg
      viewBox="0 0 44 44"
      width={size}
      height={size}
      className={className}
      aria-label="Particulares"
      role="img"
    >
      <defs>
        <linearGradient id="partBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#111827" />
          <stop offset="100%" stopColor="#2A3547" />
        </linearGradient>
        <linearGradient id="partGlyph" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7F5F0" />
          <stop offset="100%" stopColor="hsl(var(--primary))" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="12" fill="url(#partBg)" />
      {/* Monogram "P" with keyhole void — private / individual */}
      <path
        d="M15 11h9.5c4.4 0 7.5 3 7.5 7.2 0 4.3-3.1 7.3-7.6 7.3H20V33h-5V11z"
        fill="url(#partGlyph)"
      />
      <circle cx="24.2" cy="18.4" r="2.4" fill="#111827" />
    </svg>
  );
}
