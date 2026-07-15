interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showMark?: boolean;
  className?: string;
  dark?: boolean;
}

// Altura visual do logo (em px). Como o PNG já contém o wordmark "GoDalz",
// não precisamos renderizar texto separado — a marca inteira vive na imagem.
const sizeMap: Record<NonNullable<BrandLogoProps["size"]>, number> = {
  sm: 36,
  md: 48,
  lg: 64,
  xl: 80,
};

export default function BrandLogo({ size = "md", className = "" }: BrandLogoProps) {
  const height = sizeMap[size];

  return (
    <div className={`inline-flex items-center ${className}`}>
      <img
        src="/godalz-logo.png"
        alt="GoDalz"
        style={{ height, width: "auto" }}
        className="shrink-0 select-none"
        draggable={false}
      />
    </div>
  );
}
