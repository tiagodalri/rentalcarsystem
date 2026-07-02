interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showMark?: boolean;
  className?: string;
  dark?: boolean;
}

const sizeMap = {
  sm: { mark: 28, text: "text-[15px]", gap: "gap-2.5" },
  md: { mark: 36, text: "text-xl", gap: "gap-3" },
  lg: { mark: 44, text: "text-[28px]", gap: "gap-3.5" },
  xl: { mark: 52, text: "text-[34px]", gap: "gap-4" },
};

export default function BrandLogo({ size = "md", showMark = true, className = "", dark = false }: BrandLogoProps) {
  const cfg = sizeMap[size];
  const color = dark ? "#ffffff" : "#1B3528";

  return (
    <div className={`inline-flex items-center ${cfg.gap} ${className}`}>
      {showMark && (
        <svg
          width={cfg.mark}
          height={cfg.mark}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
        >
          <circle cx="24" cy="24" r="22" stroke={color} strokeWidth="2.5" fill="none" />
          <line x1="12" y1="24" x2="36" y2="24" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
      <span
        className={`font-semibold uppercase whitespace-nowrap ${cfg.text}`}
        style={{
          fontFamily: "'Cormorant Garamond', 'Cormorant Garamond Variable', serif",
          letterSpacing: "0.25em",
          color,
          lineHeight: 1.1,
        }}
      >
        SUA MARCA
      </span>
    </div>
  );
}
