import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Gauge,
  Activity,
  Plug,
  Wrench,
  Fuel,
  MapPin,
  Bell,
  BatteryLow,
  Disc,
  ShieldAlert,
  CircleDot,
  CarFront,
  PlaneLanding,
  type LucideIcon,
} from "lucide-react";
import type { LiveVehicle } from "@/hooks/useFleetLive";
import { getCoverImage } from "@/data/vehicleImages";

/* -------------------------------------------------------------------------- */
/*  Central de Alertas da Frota — camada de apresentação (dados derivados)    */
/*  Vocabulário / cores / ícones alinhados a NotificationsTab.describeEvent.  */
/* -------------------------------------------------------------------------- */

type Severity = "critical" | "warning" | "info";
type Category = "drive" | "vehicle" | "care";

type AlertTemplate = {
  key: string;
  severity: Severity;
  category: Category;
  title: string;
  descTemplate: string;                // {name}, {plate} substituídos
  Icon: LucideIcon;
  minutesAgo: number;                  // determinístico, últimas ~48h
};

// Distribuição fixa: 4 críticos, 7 atenção, 4 info = 15
const ALERT_TEMPLATES: AlertTemplate[] = [
  // CRÍTICOS (4)
  {
    key: "geofence-out",
    severity: "critical",
    category: "vehicle",
    title: "Veículo fora da área permitida",
    descTemplate: "Detectado em Savannah, GA — 512 km fora do raio autorizado",
    Icon: ShieldAlert,
    minutesAgo: 22,
  },
  {
    key: "unauthorized-move",
    severity: "critical",
    category: "vehicle",
    title: "Movimento sem reserva ativa",
    descTemplate: "Nenhuma reserva ou check-in de funcionário vinculado a este deslocamento",
    Icon: AlertTriangle,
    minutesAgo: 96,
  },
  {
    key: "speed-severe",
    severity: "critical",
    category: "drive",
    title: "Excesso de velocidade",
    descTemplate: "Atingiu 94 mph em via de 65 mph — I-4, Orlando",
    Icon: Gauge,
    minutesAgo: 165,
  },
  {
    key: "mil-on",
    severity: "critical",
    category: "vehicle",
    title: "Luz de injeção acesa",
    descTemplate: "Códigos: P0420, P0171 — recomenda-se diagnóstico",
    Icon: Wrench,
    minutesAgo: 310,
  },
  // ATENÇÃO (7)
  {
    key: "hard-accel-recurrent",
    severity: "warning",
    category: "drive",
    title: "Aceleração brusca",
    descTemplate: "3 acelerações bruscas nas últimas 2 horas",
    Icon: Gauge,
    minutesAgo: 48,
  },
  {
    key: "hard-brake",
    severity: "warning",
    category: "drive",
    title: "Freada brusca",
    descTemplate: "Detectada a 58 mph — Sand Lake Rd, Orlando",
    Icon: AlertTriangle,
    minutesAgo: 130,
  },
  {
    key: "fuel-low",
    severity: "warning",
    category: "vehicle",
    title: "Aviso de combustível",
    descTemplate: "Tanque em 8% — autonomia estimada de 42 km",
    Icon: Fuel,
    minutesAgo: 75,
  },
  {
    key: "oil-overdue",
    severity: "warning",
    category: "care",
    title: "Troca de óleo vencida",
    descTemplate: "Vencida há 1.240 km — última troca em 12/05",
    Icon: Wrench,
    minutesAgo: 640,
  },
  {
    key: "service-soon",
    severity: "warning",
    category: "care",
    title: "Revisão programada próxima",
    descTemplate: "Faltam 380 km para a revisão de 60.000 km",
    Icon: Wrench,
    minutesAgo: 890,
  },
  {
    key: "battery-low",
    severity: "warning",
    category: "vehicle",
    title: "Alerta de bateria",
    descTemplate: "11,4V — abaixo do padrão",
    Icon: BatteryLow,
    minutesAgo: 1120,
  },
  {
    key: "idle-long",
    severity: "warning",
    category: "drive",
    title: "Veículo ocioso",
    descTemplate: "Motor ligado e parado há 47 min",
    Icon: Activity,
    minutesAgo: 210,
  },
  // INFO (4)
  {
    key: "tracker-disconnected",
    severity: "info",
    category: "vehicle",
    title: "Rastreador desconectado",
    descTemplate: "Sem transmissão há 3h",
    Icon: Plug,
    minutesAgo: 180,
  },
  {
    key: "tire-pressure",
    severity: "warning",
    category: "care",
    title: "Pressão de pneu baixa",
    descTemplate: "Dianteiro direito em 26 psi (ideal 33 psi)",
    Icon: Disc,
    minutesAgo: 405,
  },
  {
    key: "trip-start",
    severity: "info",
    category: "drive",
    title: "Viagem iniciada",
    descTemplate: "Início em 8825 International Dr, Orlando",
    Icon: MapPin,
    minutesAgo: 12,
  },
  {
    key: "airport-return",
    severity: "info",
    category: "drive",
    title: "Retorno do aeroporto",
    descTemplate: "Entrada registrada no MCO — Orlando International",
    Icon: PlaneLanding,
    minutesAgo: 260,
  },
];

// hash simples e determinístico para seed a partir do vehicle_id/placa
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

type Alert = {
  id: string;
  vehicle: LiveVehicle;
  severity: Severity;
  category: Category;
  title: string;
  desc: string;
  Icon: LucideIcon;
  occurredAt: Date;
};

function buildAlerts(vehicles: LiveVehicle[]): Alert[] {
  if (!vehicles.length) return [];
  // ordena vehicles por hash determinístico para não depender da ordem do backend
  const ordered = [...vehicles].sort(
    (a, b) => hashString(a.vehicle_id) - hashString(b.vehicle_id),
  );
  const now = Date.now();
  return ALERT_TEMPLATES.map((tpl, i) => {
    const v = ordered[i % ordered.length];
    return {
      id: `${tpl.key}-${v.vehicle_id}`,
      vehicle: v,
      severity: tpl.severity,
      category: tpl.category,
      title: tpl.title,
      desc: tpl.descTemplate,
      Icon: tpl.Icon,
      occurredAt: new Date(now - tpl.minutesAgo * 60_000),
    };
  });
}

function severityStyles(sev: Severity): { pill: string; iconWrap: string; ring: string } {
  if (sev === "critical") {
    return {
      pill: "bg-destructive/10 text-destructive border-destructive/30",
      iconWrap: "bg-destructive/10 text-destructive",
      ring: "border-destructive/25",
    };
  }
  if (sev === "warning") {
    return {
      pill: "bg-primary/15 text-primary border-primary/30",
      iconWrap: "bg-primary/15 text-primary",
      ring: "border-primary/20",
    };
  }
  return {
    pill: "bg-muted/50 text-muted-foreground border-border/40",
    iconWrap: "bg-muted/40 text-muted-foreground",
    ring: "border-border/30",
  };
}

function severityLabel(sev: Severity): string {
  return sev === "critical" ? "Crítico" : sev === "warning" ? "Atenção" : "Info";
}

function fmtWhen(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) {
    return `Ontem ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type FilterId = "all" | "critical" | "warning" | "drive" | "vehicle" | "care";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "critical", label: "Críticos" },
  { id: "warning", label: "Atenção" },
  { id: "drive", label: "Direção" },
  { id: "vehicle", label: "Veículo" },
  { id: "care", label: "Manutenção" },
];

export type FleetAlertsCenterProps = {
  vehicles: LiveVehicle[];
  onSelectVehicle?: (vehicleId: string) => void;
  /** Scroll suave até o mapa quando um card é clicado. */
  onFocusMap?: () => void;
};

export function FleetAlertsCenter({ vehicles, onSelectVehicle, onFocusMap }: FleetAlertsCenterProps) {
  const alerts = useMemo(() => buildAlerts(vehicles), [vehicles]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [expanded, setExpanded] = useState(false);

  const counts = useMemo(() => {
    const c: Record<FilterId, number> = {
      all: alerts.length,
      critical: 0,
      warning: 0,
      drive: 0,
      vehicle: 0,
      care: 0,
    };
    for (const a of alerts) {
      if (a.severity === "critical") c.critical++;
      if (a.severity === "warning") c.warning++;
      c[a.category]++;
    }
    return c;
  }, [alerts]);

  const filtered = useMemo(() => {
    if (filter === "all") return alerts;
    if (filter === "critical" || filter === "warning")
      return alerts.filter((a) => a.severity === filter);
    return alerts.filter((a) => a.category === filter);
  }, [alerts, filter]);

  const visible = expanded ? filtered : filtered.slice(0, 8);

  const handleClick = (a: Alert) => {
    onSelectVehicle?.(a.vehicle.vehicle_id);
    onFocusMap?.();
  };

  if (!vehicles.length) return null;

  return (
    <section className="admin-card p-4 sm:p-5" aria-label="Central de Alertas da Frota">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center">
            <Bell size={18} className="text-primary-foreground" />
          </div>
          <div>
            <h2 className="admin-h1 text-xl">Central de Alertas</h2>
            <p className="text-xs text-muted-foreground">
              Eventos que exigem sua atenção • Últimas 48h
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/30">
            <CircleDot size={10} /> {counts.critical} críticos
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
            <CircleDot size={10} /> {counts.warning} atenção
          </span>
        </div>
      </div>

      {/* Filter chips */}
      <div className="admin-chip-scroll flex gap-1.5 -mx-1 px-1 pb-1 mb-4 overflow-x-auto">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const n = counts[f.id];
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setExpanded(false);
              }}
              className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium transition-colors border ${
                active
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-card/40 text-muted-foreground border-border/40 hover:text-foreground hover:border-border/60"
              }`}
              aria-pressed={active}
            >
              {f.label}
              <span
                className={`tabular-nums text-[10px] px-1.5 py-px rounded ${
                  active ? "bg-primary/20" : "bg-muted/40"
                }`}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 rounded-lg border border-dashed border-border/40">
          <Activity size={22} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Nenhum alerta nesta categoria.</p>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visible.map((a) => {
              const s = severityStyles(a.severity);
              const Icon = a.Icon;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(a)}
                    className={`w-full text-left flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border ${s.ring} bg-card/50 hover:bg-card/80 hover:border-border/70 transition-colors min-h-[44px] motion-safe:duration-200`}
                  >
                    {/* Vehicle thumb */}
                    <img
                      src={getCoverImage(a.vehicle.name)}
                      alt=""
                      loading="lazy"
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-border/30 shrink-0 bg-muted"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${s.iconWrap}`}
                        >
                          <Icon size={13} />
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${s.pill}`}
                        >
                          {severityLabel(a.severity)}
                        </span>
                        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {fmtWhen(a.occurredAt)}
                        </span>
                      </div>

                      <p className="text-[13px] font-semibold text-foreground leading-snug">
                        {a.title}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                        {a.desc}
                      </p>

                      <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground min-w-0">
                        <CarFront size={12} className="shrink-0" />
                        <span className="truncate">{a.vehicle.name}</span>
                        {a.vehicle.plate && (
                          <span className="font-mono px-1.5 py-0.5 rounded bg-muted/40 border border-border/30 tabular-nums shrink-0">
                            {a.vehicle.plate}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {filtered.length > 8 && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-border/50 bg-card/50 text-[12px] font-medium hover:bg-card/80 hover:border-border/70 transition-colors"
              >
                {expanded
                  ? "Recolher lista"
                  : `Ver todos os ${filtered.length} alertas`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
