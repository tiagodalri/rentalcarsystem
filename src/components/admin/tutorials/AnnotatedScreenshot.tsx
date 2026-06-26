import { useState } from "react";
import { cn } from "@/lib/utils";

export type Hotspot = {
  n: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
};

interface Props {
  src: string;
  alt: string;
  hotspots?: Hotspot[];
  activeN?: number | null;
  onHotspotEnter?: (n: number) => void;
  onHotspotLeave?: () => void;
  className?: string;
}

/**
 * AnnotatedScreenshot
 * Big-tech feel: full screenshot visible (object-contain), refined gold pins
 * with halo + spotlight cutout effect when a hotspot is focused.
 */
export function AnnotatedScreenshot({
  src,
  alt,
  hotspots = [],
  activeN,
  onHotspotEnter,
  onHotspotLeave,
  className,
}: Props) {
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const [hoverN, setHoverN] = useState<number | null>(null);
  const focused = activeN ?? hoverN;
  const focusedHs = hotspots.find((h) => h.n === focused);

  return (
    <div
      className={cn(
        "relative w-full max-h-full rounded-2xl overflow-hidden",
        "bg-[#0a0a0a] ring-1 ring-border/50",
        "shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)_inset]",
        className
      )}
      style={{ aspectRatio: naturalRatio ? String(naturalRatio) : "16 / 10" }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) {
            setNaturalRatio(img.naturalWidth / img.naturalHeight);
          }
        }}
        className="absolute inset-0 h-full w-full object-contain select-none"
        draggable={false}
      />

      {/* Dim everything except focused area (spotlight effect) */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-300",
          focused ? "opacity-100" : "opacity-0"
        )}
        style={{
          background: "rgba(0,0,0,0.42)",
          maskImage: focusedHs
            ? `radial-gradient(ellipse ${Math.max(focusedHs.w ?? 14, 14)}% ${Math.max(focusedHs.h ?? 14, 14)}% at ${focusedHs.x}% ${focusedHs.y}%, transparent 55%, black 100%)`
            : undefined,
          WebkitMaskImage: focusedHs
            ? `radial-gradient(ellipse ${Math.max(focusedHs.w ?? 14, 14)}% ${Math.max(focusedHs.h ?? 14, 14)}% at ${focusedHs.x}% ${focusedHs.y}%, transparent 55%, black 100%)`
            : undefined,
        }}
      />

      {/* Highlight rectangles */}
      {hotspots.map((hs) => {
        const isFocus = focused === hs.n;
        if (!hs.w || !hs.h) return null;
        return (
          <div
            key={`rect-${hs.n}`}
            className={cn(
              "pointer-events-none absolute rounded-md transition-all duration-300 ease-out",
              isFocus
                ? "border-2 border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.18),0_0_30px_hsl(var(--primary)/0.5)]"
                : "border border-primary/0"
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
            className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none z-10"
            style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 -m-2 rounded-full bg-primary/40 transition-all duration-500",
                isFocus ? "animate-ping" : "opacity-0 group-hover:opacity-60"
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold tabular-nums",
                "ring-2 ring-background/90 shadow-[0_6px_20px_rgba(0,0,0,0.5)] transition-all duration-200",
                isFocus
                  ? "bg-primary text-primary-foreground scale-110"
                  : "bg-primary/95 text-primary-foreground hover:scale-110"
              )}
            >
              {hs.n}
            </span>
          </button>
        );
      })}

      {/* Floating label for focused hotspot */}
      {focusedHs && (
        <div
          className="pointer-events-none absolute z-20 transition-all duration-200"
          style={{
            left: `${focusedHs.x}%`,
            top: `${Math.min(focusedHs.y + (focusedHs.h ?? 0) / 2 + 4, 90)}%`,
            transform: "translate(-50%, 0)",
          }}
        >
          <div className="rounded-lg border border-primary/50 bg-background/95 backdrop-blur px-3 py-1.5 text-[11.5px] font-medium text-foreground shadow-xl max-w-[260px] text-center leading-snug">
            {focusedHs.label}
          </div>
        </div>
      )}
    </div>
  );
}
