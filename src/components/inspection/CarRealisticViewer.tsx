import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import carFront from "@/assets/inspection/car-silver-front.jpg";
import carRear from "@/assets/inspection/car-silver-rear.jpg";
import carTop from "@/assets/inspection/car-silver-top.jpg";

/**
 * CarRealisticViewer
 * Inspeção visual sobre fotografia real do veículo (sedan prata premium).
 * - 3 ângulos: 3/4 frontal, 3/4 traseira, superior
 * - Pins clicáveis sobre cada peça, com hover destacando o nome
 * - Pin com avaria mostra badge dourado com a contagem
 * - Mantém o contrato existente: emite o `label` da peça via onAddDamage
 */

type Hotspot = {
  /** human-readable label, ALSO the key used in damageCountByLabel */
  label: string;
  /** % from left of image */
  x: number;
  /** % from top of image */
  y: number;
};

type ViewId = "front" | "rear" | "top";

type ViewDef = {
  id: ViewId;
  label: string;
  short: string;
  src: string;
  /** native ratio width / height — used to keep image proportional */
  aspect: number;
  hotspots: Hotspot[];
};

const VIEWS: ViewDef[] = [
  {
    id: "front",
    label: "Vista 3/4 Frontal",
    short: "Frontal",
    src: carFront,
    aspect: 1600 / 1024,
    hotspots: [
      { label: "Capô", x: 48, y: 52 },
      { label: "Para-brisa", x: 62, y: 39 },
      { label: "Teto", x: 71, y: 27 },
      { label: "Para-choque dianteiro", x: 31, y: 73 },
      { label: "Para-lama dianteiro esquerdo", x: 38, y: 60 },
      { label: "Porta dianteira esquerda", x: 53, y: 55 },
      { label: "Porta traseira esquerda", x: 67, y: 53 },
      { label: "Para-lama traseiro esquerdo", x: 84, y: 54 },
      { label: "Farol dianteiro", x: 24, y: 62 },
      { label: "Retrovisor esquerdo", x: 56, y: 45 },
      { label: "Roda dianteira esquerda", x: 37, y: 77 },
      { label: "Roda traseira esquerda", x: 84, y: 71 },
      { label: "Vidro dianteiro lateral esquerdo", x: 58, y: 38 },
      { label: "Vidro traseiro lateral esquerdo", x: 70, y: 38 },
      { label: "Soleira lateral esquerda", x: 65, y: 72 },
    ],
  },
  {
    id: "rear",
    label: "Vista 3/4 Traseira",
    short: "Traseira",
    src: carRear,
    aspect: 1600 / 1024,
    hotspots: [
      { label: "Tampa do porta-malas", x: 43, y: 47 },
      { label: "Vidro traseiro", x: 52, y: 35 },
      { label: "Teto", x: 66, y: 25 },
      { label: "Para-choque traseiro", x: 38, y: 68 },
      { label: "Para-lama traseiro direito", x: 76, y: 56 },
      { label: "Porta traseira direita", x: 84, y: 51 },
      { label: "Porta dianteira direita", x: 92, y: 47 },
      { label: "Retrovisor direito", x: 84, y: 42 },
      { label: "Lanterna traseira", x: 22, y: 49 },
      { label: "Escapamento", x: 30, y: 75 },
      { label: "Roda traseira direita", x: 77, y: 75 },
      { label: "Roda dianteira direita", x: 95, y: 65 },
    ],
  },
  {
    id: "top",
    label: "Vista Superior",
    short: "Superior",
    src: carTop,
    aspect: 1024 / 1600,
    hotspots: [
      { label: "Para-choque dianteiro", x: 50, y: 18 },
      { label: "Capô", x: 50, y: 28 },
      { label: "Para-brisa", x: 50, y: 41 },
      { label: "Teto", x: 50, y: 55 },
      { label: "Vidro traseiro", x: 50, y: 68 },
      { label: "Tampa do porta-malas", x: 50, y: 79 },
      { label: "Para-choque traseiro", x: 50, y: 88 },
      { label: "Para-lama dianteiro esquerdo", x: 28, y: 25 },
      { label: "Para-lama dianteiro direito", x: 72, y: 25 },
      { label: "Para-lama traseiro esquerdo", x: 28, y: 77 },
      { label: "Para-lama traseiro direito", x: 72, y: 77 },
      { label: "Retrovisor esquerdo", x: 26, y: 41 },
      { label: "Retrovisor direito", x: 74, y: 41 },
      { label: "Roda dianteira esquerda", x: 19, y: 27 },
      { label: "Roda dianteira direita", x: 81, y: 27 },
      { label: "Roda traseira esquerda", x: 19, y: 77 },
      { label: "Roda traseira direita", x: 81, y: 77 },
    ],
  },
];

interface Props {
  damageCountByLabel: Record<string, number>;
  onAddDamage: (label: string) => void;
  disabled?: boolean;
}

export default function CarRealisticViewer({
  damageCountByLabel,
  onAddDamage,
  disabled,
}: Props) {
  const [viewId, setViewId] = useState<ViewId>("front");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const view = useMemo(
    () => VIEWS.find((v) => v.id === viewId) ?? VIEWS[0],
    [viewId]
  );

  return (
    <div className="space-y-3">
      {/* View switcher */}
      <div className="flex items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Ângulo do veículo"
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border/40"
        >
          {VIEWS.map((v) => {
            const active = v.id === viewId;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setViewId(v.id);
                  setHoverIdx(null);
                }}
                className={cn(
                  "px-3.5 h-8 rounded-md text-[11.5px] font-medium tracking-wide transition-all",
                  active
                    ? "bg-card text-foreground shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v.short}
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[10.5px] text-muted-foreground tracking-[0.18em] uppercase">
          <span className="h-1 w-1 rounded-full bg-primary" />
          Clique no marcador da peça para registrar
        </div>
      </div>

      {/* Image stage */}
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border/40 bg-gradient-to-b from-[#fafaf6] to-[#f0eee8] dark:from-[#1a1a1a] dark:to-[#0d0d0d]"
        style={{ aspectRatio: view.aspect }}
      >
        {/* Photo */}
        <img
          src={view.src}
          alt={view.label}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
          draggable={false}
        />

        {/* Subtle vignette so the photo blends with card */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_60%,hsl(var(--background)/0.35)_100%)]" />

        {/* Caption pill */}
        <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-background/85 backdrop-blur-md border border-border/60 text-[10px] font-medium tracking-[0.16em] uppercase text-foreground/80">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {view.label}
        </div>

        {/* Hotspots */}
        {view.hotspots.map((h, i) => {
          const count = damageCountByLabel[h.label] || 0;
          const hasDamage = count > 0;
          const isHover = hoverIdx === i;
          return (
            <button
              key={`${view.id}-${i}-${h.label}`}
              type="button"
              disabled={disabled}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx((prev) => (prev === i ? null : prev))}
              onFocus={() => setHoverIdx(i)}
              onBlur={() => setHoverIdx((prev) => (prev === i ? null : prev))}
              onClick={() => !disabled && onAddDamage(h.label)}
              aria-label={`${h.label}${count ? ` (${count} avaria${count > 1 ? "s" : ""})` : ""}`}
              className={cn(
                "group absolute -translate-x-1/2 -translate-y-1/2 z-20",
                "h-7 w-7 sm:h-8 sm:w-8 rounded-full",
                "flex items-center justify-center",
                "transition-all duration-200 ease-out",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                hasDamage
                  ? "bg-primary text-primary-foreground shadow-[0_0_0_3px_hsl(var(--primary)/0.18),0_4px_14px_hsl(var(--primary)/0.45)]"
                  : "bg-background/85 backdrop-blur-md border border-foreground/15 hover:border-primary/60 hover:bg-background shadow-[0_2px_8px_rgba(0,0,0,0.18)]",
                isHover && !hasDamage && "ring-2 ring-primary/40 border-primary/70 scale-110",
                isHover && hasDamage && "scale-110"
              )}
              style={{ left: `${h.x}%`, top: `${h.y}%` }}
            >
              {/* Inner mark */}
              {hasDamage ? (
                <span className="text-[10.5px] font-semibold tabular-nums leading-none">
                  {count}
                </span>
              ) : (
                <span
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    isHover ? "bg-primary" : "bg-foreground/60"
                  )}
                />
              )}

              {/* Pulse for damaged */}
              {hasDamage && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-primary/40 animate-ping opacity-40"
                />
              )}

              {/* Floating label */}
              {isHover && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full whitespace-nowrap pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-150"
                >
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-foreground text-background text-[10.5px] font-medium tracking-wide shadow-lg">
                    {h.label}
                    {count > 0 && (
                      <span className="ml-0.5 text-primary tabular-nums">· {count}</span>
                    )}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-1">
        <span className="flex items-center gap-2 text-[10.5px] text-muted-foreground tracking-[0.16em] uppercase font-medium">
          <span className="w-2.5 h-2.5 rounded-full border border-foreground/30 bg-background inline-block" />
          Sem avaria
        </span>
        <span className="flex items-center gap-2 text-[10.5px] text-muted-foreground tracking-[0.16em] uppercase font-medium">
          <span
            className="w-2.5 h-2.5 rounded-full bg-primary inline-block"
            style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.55)" }}
          />
          Com avaria
        </span>
      </div>
    </div>
  );
}
