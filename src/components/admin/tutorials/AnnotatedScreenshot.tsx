import { useState } from "react";
import { cn } from "@/lib/utils";

export type Hotspot = {
  /** number shown inside the marker (1-based) */
  n: number;
  /** % from left of the image (0–100) */
  x: number;
  /** % from top of the image (0–100) */
  y: number;
  /** optional rectangle width as % of image width to draw a highlight box */
  w?: number;
  /** optional rectangle height as % of image height */
  h?: number;
  /** short label (used as tooltip and in the right-side legend) */
  label: string;
};

interface Props {
  src: string;
  alt: string;
  hotspots?: Hotspot[];
  /** which hotspot number is currently focused (driven by parent) */
  activeN?: number | null;
  onHotspotEnter?: (n: number) => void;
  onHotspotLeave?: () => void;
  /** Optional aspect ratio (width / height) — defaults to 16/10 to match capture */
  aspect?: number;
  className?: string;
}

/**
 * AnnotatedScreenshot
 * Renders a real screenshot of the system with numbered, gold hotspots
 * positioned in percentages so it scales responsively. Supports a rectangle
 * highlight (w/h) plus a numbered pin per hotspot.
 */
export function AnnotatedScreenshot({
  src,
  alt,
  hotspots = [],
  activeN,
  onHotspotEnter,
  onHotspotLeave,
  aspect = 16 / 10,
  className,
}: Props) {
  const [hoverN, setHoverN] = useState<number | null>(null);
  const focused = activeN ?? hoverN;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-border/50 bg-[#0a0a0a] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]",
        className
      )}
      style={{ aspectRatio: String(aspect) }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover object-top select-none"
        draggable={false}
      />

      {/* Soft vignette so callouts pop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/15" />

      {/* Hotspot rectangle highlights (rendered below the pin) */}
      {hotspots.map((hs) => {
        const isFocus = focused === hs.n;
        if (!hs.w || !hs.h) return null;
        return (
          <div
            key={`rect-${hs.n}`}
            className={cn(
              "pointer-events-none absolute rounded-lg transition-all duration-300 ease-out",
              isFocus
                ? "border-2 border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.18),0_0_24px_hsl(var(--primary)/0.45)]"
                : "border border-primary/40"
            )}
            style={{
              left: `${hs.x - hs.w / 2}%`,
              top: `${hs.y - hs.h / 2}%`,
              width: `${hs.w}%`,
              height: `${hs.h}%`,
            }}
          />
        );
      })}

      {/* Numbered pins */}
      {hotspots.map((hs) => {
        const isFocus = focused === hs.n;
        return (
          <button
            type="button"
            key={`pin-${hs.n}`}
            onMouseEnter={() => {
              setHoverN(hs.n);
              onHotspotEnter?.(hs.n);
            }}
            onMouseLeave={() => {
              setHoverN(null);
              onHotspotLeave?.();
            }}
            onFocus={() => {
              setHoverN(hs.n);
              onHotspotEnter?.(hs.n);
            }}
            onBlur={() => {
              setHoverN(null);
              onHotspotLeave?.();
            }}
            aria-label={`${hs.n}. ${hs.label}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
            style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
          >
            {/* pulse ring */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 -m-1 rounded-full bg-primary/35 transition-all duration-500",
                isFocus ? "animate-ping" : "opacity-0 group-hover:opacity-100"
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold tabular-nums shadow-[0_4px_14px_rgba(0,0,0,0.45)] transition-all duration-200",
                isFocus
                  ? "bg-primary text-primary-foreground scale-110 ring-2 ring-primary/60"
                  : "bg-primary/95 text-primary-foreground hover:scale-105"
              )}
            >
              {hs.n}
            </span>
            {/* tooltip on hover */}
            <span
              className={cn(
                "pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-primary/40 bg-background/95 px-2.5 py-1 text-[11px] font-medium text-foreground backdrop-blur shadow-lg transition-all duration-150",
                isFocus ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
              )}
            >
              {hs.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
