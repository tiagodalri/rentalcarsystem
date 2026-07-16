interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showMark?: boolean;
  className?: string;
  /** Force dark-background variant (white logo). Auto-detects when omitted. */
  dark?: boolean;
  /** Force light-background variant (black logo). */
  light?: boolean;
}

// GoDrive: altura visual do wordmark completo (símbolo + "GO DRIVE").
// Aumentado ~15% em cada tier para dar mais presença de marca premium.
const sizeMap: Record<NonNullable<BrandLogoProps["size"]>, number> = {
  sm: 40,
  md: 56,
  lg: 72,
  xl: 96,
};

/**
 * BrandLogo — wordmark oficial GoDrive.
 *  - Em fundos escuros (sidebar admin, hero preto): variante branca.
 *  - Em fundos claros (site público, login): variante preta.
 *  - Fidelidade absoluta ao logo original (Especificação Mestra §6).
 */
export default function BrandLogo({
  size = "md",
  className = "",
  dark,
  light,
}: BrandLogoProps) {
  const height = sizeMap[size];

  // Quando `dark` é explícito, honramos. Quando `light`, idem.
  // Caso contrário deixamos o CSS pai decidir via [data-theme]: default = preto.
  const src =
    dark === true
      ? "/brand/logo-white.png"
      : light === true
        ? "/brand/logo-black.png"
        : "/brand/logo-black.png";

  return (
    <div className={`inline-flex items-center ${className}`}>
      <img
        src={src}
        alt="GoDrive"
        style={{ height, width: "auto" }}
        className="shrink-0 select-none"
        draggable={false}
      />
    </div>
  );
}
