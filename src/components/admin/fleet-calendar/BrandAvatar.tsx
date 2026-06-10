import { useState } from "react";
import { carLogoUrl, findBrandByName } from "@/data/carBrands";

type Props = {
  brand?: string | null;
  name: string;
  size?: number;
};

// Stable color from brand string — used as fallback when CDN logo fails
function hashColor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export function BrandAvatar({ brand, name, size = 32 }: Props) {
  const [errored, setErrored] = useState(false);
  const matched = brand ? findBrandByName(brand) : undefined;
  const logo = matched ? matched.logoUrl : brand ? carLogoUrl(brand.toLowerCase().replace(/\s+/g, "-")) : null;
  const initial = (brand || name || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      className="shrink-0 rounded-md border border-border/40 bg-background flex items-center justify-center overflow-hidden"
      style={{ width: size, height: size }}
    >
      {logo && !errored ? (
        <img
          src={logo}
          alt={brand || name}
          loading="lazy"
          onError={() => setErrored(true)}
          className="w-[78%] h-[78%] object-contain dark:invert dark:brightness-150 dark:contrast-125"
        />
      ) : (
        <span
          className="w-full h-full flex items-center justify-center text-[11px] font-medium text-white"
          style={{ background: hashColor(brand || name) }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
