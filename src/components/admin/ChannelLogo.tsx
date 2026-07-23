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
  // Official Turo wordmark (Wikipedia commons). Kept at its native 88x32
  // ratio, centered inside a 44x44 slot to match the other channel cards.
  return (
    <div
      className={className}
      style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}
      aria-label="Turo"
      role="img"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 88 32"
        width={size}
        height={(size * 32) / 88}
        fill="none"
      >
        <path
          fill="#121214"
          d="m77.416 2.853-.529-.666a6 6 0 0 0-.556-.614C75.261.56 73.824 0 72.305 0H0v32h72.319a5.86 5.86 0 0 0 4.026-1.573c.203-.187.38-.387.556-.6.013-.014.013-.027.027-.04l10.817-13.774z"
        />
        <path
          fill="#FFFFFF"
          d="M65.513 22.927c-4.162 0-7.429-3.213-7.429-7.333 0-3.867 3.349-7.014 7.456-7.014 1.993 0 3.85.747 5.246 2.08a7.06 7.06 0 0 1 2.183 5.134c0 3.933-3.349 7.133-7.456 7.133m0-11.867c-1.37 0-2.63.48-3.538 1.334-.922.866-1.423 2.093-1.423 3.426 0 1.267.528 2.44 1.504 3.307.936.84 2.21 1.32 3.498 1.32 1.328 0 2.562-.48 3.497-1.373a4.65 4.65 0 0 0 1.464-3.387c0-1.293-.529-2.48-1.478-3.333-.949-.84-2.182-1.294-3.524-1.294M31.76 22.874c-3.322 0-4.772-1.587-5.246-2.28-.732-1.067-.8-2.094-.8-3.227v-8.4h2.48v8.4c0 .88.055 1.547.665 2.16.61.6 1.653.88 3.199.88 1.26 0 2.087-.2 2.643-.627.583-.466.868-1.253.868-2.413v-8.4h2.453v8.4c0 1.307-.067 2.32-1.003 3.507-1.328 1.733-3.863 2-5.26 2m20.482-.267-2.792-4.933h-4.528v4.933h-2.494V8.967h8.16c2.63 0 4.474 1.8 4.474 4.373 0 2.014-1.125 3.6-2.942 4.16l2.942 5.107zm-1.64-7.387c.596 0 1.992-.186 1.992-1.973 0-1.133-.759-1.84-1.992-1.84h-5.666v3.813zm-35.963 7.387V11.42H9.895V8.967h11.928v2.453H17.08v11.187z"
        />
      </svg>
    </div>
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
