import { useState } from "react";
import { CAR_BRANDS, findBrandByName, type CarBrand } from "@/data/carBrands";

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

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Common model→brand inference for popular nameplates that often appear without explicit brand
const MODEL_TO_BRAND_SLUG: Record<string, string> = {
  mustang: "ford",
  corvette: "chevrolet",
  camaro: "chevrolet",
  silverado: "chevrolet",
  tahoe: "chevrolet",
  suburban: "chevrolet",
  malibu: "chevrolet",
  equinox: "chevrolet",
  escalade: "cadillac",
  wrangler: "jeep",
  cherokee: "jeep",
  compass: "jeep",
  renegade: "jeep",
  charger: "dodge",
  challenger: "dodge",
  durango: "dodge",
  explorer: "ford",
  expedition: "ford",
  bronco: "ford",
  edge: "ford",
  fusion: "ford",
  corolla: "toyota",
  camry: "toyota",
  rav4: "toyota",
  highlander: "toyota",
  tacoma: "toyota",
  tundra: "toyota",
  civic: "honda",
  accord: "honda",
  pilot: "honda",
  odyssey: "honda",
  altima: "nissan",
  sentra: "nissan",
  rogue: "nissan",
  pathfinder: "nissan",
  murano: "nissan",
  versa: "nissan",
  elantra: "hyundai",
  sonata: "hyundai",
  tucson: "hyundai",
  optima: "kia",
  sorento: "kia",
  sportage: "kia",
  telluride: "kia",
  outlander: "mitsubishi",
  eclipse: "mitsubishi",
  lancer: "mitsubishi",
  pajero: "mitsubishi",
};

function inferBrand(name: string, brand?: string | null): CarBrand | undefined {
  if (brand && brand.trim()) {
    const direct = findBrandByName(brand);
    if (direct) return direct;
  }
  const cleanName = norm(name);
  // try multi-word brand match first (e.g. "Land Rover", "Alfa Romeo", "Mercedes-Benz")
  const multi = CAR_BRANDS.find((b) => {
    const bn = norm(b.name);
    return bn.includes(" ") && cleanName.startsWith(bn);
  });
  if (multi) return multi;
  const tokens = cleanName.split(/[\s\-_/]+/).filter(Boolean);
  for (const t of tokens) {
    const m = CAR_BRANDS.find((b) => norm(b.name) === t || b.slug === t);
    if (m) return m;
  }
  for (const t of tokens) {
    const slug = MODEL_TO_BRAND_SLUG[t];
    if (slug) {
      const m = CAR_BRANDS.find((b) => b.slug === slug);
      if (m) return m;
    }
  }
  return undefined;
}

export function BrandAvatar({ brand, name, size = 32 }: Props) {
  const [errored, setErrored] = useState(false);
  const matched = inferBrand(name, brand);
  const logo = matched?.logoUrl ?? null;
  const initial = (matched?.name || brand || name || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      className="shrink-0 rounded-md border border-border/40 bg-background flex items-center justify-center overflow-hidden"
      style={{ width: size, height: size }}
    >
      {logo && !errored ? (
        <img
          src={logo}
          alt={matched?.name || brand || name}
          loading="lazy"
          onError={() => setErrored(true)}
          className="w-[78%] h-[78%] object-contain dark:invert dark:brightness-150 dark:contrast-125"
        />
      ) : (
        <span
          className="w-full h-full flex items-center justify-center text-[11px] font-medium text-white"
          style={{ background: hashColor(matched?.slug || brand || name) }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
