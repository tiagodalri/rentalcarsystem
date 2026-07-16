import { useEffect, useState, type RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { getFleetAlertCounts } from "./FleetAlertsCenter";
import type { LiveVehicle } from "@/hooks/useFleetLive";

/**
 * Pílula flutuante que sinaliza a Central de Alertas abaixo do mapa.
 * - Mostra a contagem real de críticos (fallback: total).
 * - Some (fade-out 200ms) quando a Central entra na viewport.
 * - Click faz scroll suave até a Central. Só camada visual.
 */
type Props = {
  vehicles: LiveVehicle[];
  /** ref da <section> da Central de Alertas — observada via IntersectionObserver. */
  targetRef: RefObject<HTMLElement>;
  /** hide externo (ex.: quando o preview do veículo está aberto). */
  hidden?: boolean;
  className?: string;
};

export function AlertsScrollPill({ vehicles, targetRef, hidden, className = "" }: Props) {
  const [inView, setInView] = useState(false);
  const counts = getFleetAlertCounts(vehicles);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [targetRef]);

  if (counts.total === 0) return null;

  const shouldHide = Boolean(hidden) || inView;
  const hasCritical = counts.critical > 0;

  const label = hasCritical
    ? `${counts.critical} ${counts.critical === 1 ? "alerta crítico" : "alertas críticos"}`
    : `${counts.total} ${counts.total === 1 ? "alerta" : "alertas"} • Ver central`;

  const handleClick = () => {
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Ver central de alertas"
      aria-hidden={shouldHide}
      tabIndex={shouldHide ? -1 : 0}
      className={[
        "group inline-flex items-center gap-2 h-11 pl-3 pr-3.5 rounded-full",
        "border border-primary/40",
        // desktop: grafite translúcido com blur; mobile: quase opaco (perf)
        "bg-neutral-900/90 sm:bg-neutral-900/70 sm:backdrop-blur-md",
        "text-neutral-50 shadow-lg shadow-black/25",
        "transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        "hover:border-primary/60 hover:bg-neutral-900/95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        "active:scale-[0.98] motion-reduce:active:scale-100",
        shouldHide ? "opacity-0 pointer-events-none translate-y-1" : "opacity-100",
        className,
      ].join(" ")}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className={[
            "motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full opacity-70",
            hasCritical ? "bg-red-500" : "bg-primary",
          ].join(" ")}
        />
        <span
          className={[
            "relative inline-flex rounded-full h-2 w-2",
            hasCritical ? "bg-red-500" : "bg-primary",
          ].join(" ")}
        />
      </span>
      <span
        className={[
          "text-[12px] font-semibold tracking-tight tabular-nums",
          hasCritical ? "text-red-400" : "text-neutral-100",
        ].join(" ")}
      >
        {label}
      </span>
      <ChevronDown
        size={14}
        className="text-primary motion-safe:animate-nudge-down"
        aria-hidden
      />
    </button>
  );
}
