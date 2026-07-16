import { Car, Plane, MapPin, ArrowRight, ArrowLeftRight, ChevronRight, Clock } from "lucide-react";
import { formatPersonName } from "@/lib/formatName";
import { PersonAvatar } from "@/components/ui/PersonAvatar";

type Booking = {
  id: string;
  customer_name: string;
  pickup_date: string;
  return_date: string;
  pickup_time: string | null;
  return_time: string | null;
  pickup_location: string | null;
  return_location: string | null;
  total_price: number | null;
  status: string;
  vehicle_name?: string;
  vehicle_image?: string;
};

type StatusMeta = {
  label: string;
  /** chip color tokens */
  chip: string;
  /** top accent bar (bg-* class) */
  bar: string;
  /** progress fill (bg-* class) */
  bar_fill: string;
};

const META: Record<string, StatusMeta> = {
  pending:     { label: "Pendente",     chip: "bg-yellow-500/12 text-yellow-700 dark:text-yellow-400 border-yellow-500/30", bar: "bg-yellow-500",        bar_fill: "bg-yellow-500" },
  confirmed:   { label: "Confirmada",   chip: "bg-blue-500/12 text-blue-600 dark:text-blue-400 border-blue-500/30",         bar: "bg-blue-500",          bar_fill: "bg-blue-500" },
  active:      { label: "Ativa",        chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", bar: "bg-emerald-500",   bar_fill: "bg-emerald-500" },
  in_progress: { label: "Em andamento", chip: "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30",     bar: "bg-amber-500",         bar_fill: "bg-amber-500" },
  completed:   { label: "Concluída",    chip: "bg-muted text-muted-foreground border-border/40",                              bar: "bg-muted-foreground/40", bar_fill: "bg-muted-foreground/50" },
  cancelled:   { label: "Cancelada",    chip: "bg-red-500/12 text-red-600 dark:text-red-400 border-red-500/30",              bar: "bg-red-500",           bar_fill: "bg-red-500" },
};

function getProgress(pickup: string, ret: string, status: string): number {
  if (status === "completed") return 100;
  if (status === "pending" || status === "confirmed" || status === "cancelled") return 0;
  const now = Date.now();
  const start = new Date(pickup).getTime();
  const end = new Date(ret).getTime();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function parseLoc(raw: string | null) {
  if (!raw) return null;
  const [addrRaw, ...termParts] = raw.split(". ");
  const addr = (addrRaw || "").trim();
  const terminal = termParts.join(". ").trim();
  const isAirport = /airport|aeroporto|\bMCO\b|\bMIA\b|\bTPA\b|\bFLL\b|\bSFB\b|\bLAX\b|\bJFK\b/i.test(addr);
  // condense long address: keep last 2 meaningful tokens (city/state) for compactness
  const short = addr.split(",").slice(0, 2).join(",").trim();
  return { short, terminal, isAirport };
}

function formatShortDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

export function MobileBookingCard({ booking, onOpen }: { booking: Booking; onOpen: () => void }) {
  const meta = META[booking.status] || META.pending;
  const progress = getProgress(booking.pickup_date, booking.return_date, booking.status);
  const showProgress = booking.status === "active" || booking.status === "in_progress";
  const pu = parseLoc(booking.pickup_location);
  const rt = parseLoc(booking.return_location);
  const sameLoc = pu && rt && pu.short === rt.short && pu.terminal === rt.terminal;
  const total = booking.total_price ?? null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative w-full text-left rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm active:scale-[0.99] active:bg-muted/30 transition-transform"
    >
      {/* status accent bar */}
      <span aria-hidden className={`absolute inset-x-0 top-0 h-[3px] ${meta.bar}`} />

      <div className="p-4 pt-4">
        {/* Header: customer + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <PersonAvatar name={booking.customer_name} size="sm" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold leading-tight text-foreground truncate">
                {formatPersonName(booking.customer_name) || ""}
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground/80 truncate">
                #{booking.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.chip} uppercase tracking-wider`}>
            {meta.label}
          </span>
        </div>

        {/* Vehicle + total */}
        <div className="mt-3 flex items-center gap-3">
          {booking.vehicle_image ? (
            <img
              src={booking.vehicle_image}
              alt={booking.vehicle_name || ""}
              className="w-16 h-12 rounded-lg object-cover bg-muted border border-border/30 shrink-0"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-16 h-12 rounded-lg bg-muted border border-border/30 shrink-0 flex items-center justify-center">
              <Car className="w-5 h-5 text-muted-foreground/50" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-foreground truncate">
              {booking.vehicle_name || "Veículo não definido"}
            </p>
          </div>
          {total !== null && (
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider">Total</p>
              <p className="text-[15px] font-semibold tabular-nums text-foreground leading-tight">
                ${Math.round(total).toLocaleString("en-US")}
              </p>
            </div>
          )}
        </div>

        {/* Dates row */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted/40 border border-border/30 p-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
              <ArrowRight className="w-3 h-3" /> Retirada
            </div>
            <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground leading-tight">
              {formatShortDate(booking.pickup_date)}
            </p>
            <p className="text-[11px] tabular-nums text-muted-foreground flex items-center gap-1 leading-tight mt-0.5">
              <Clock className="w-2.5 h-2.5" /> {booking.pickup_time || ""}
            </p>
          </div>
          <div className="min-w-0 border-l border-border/40 pl-2.5">
            <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-orange-600 dark:text-orange-400 font-semibold">
              <ArrowRight className="w-3 h-3 rotate-180" /> Devolução
            </div>
            <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground leading-tight">
              {formatShortDate(booking.return_date)}
            </p>
            <p className="text-[11px] tabular-nums text-muted-foreground flex items-center gap-1 leading-tight mt-0.5">
              <Clock className="w-2.5 h-2.5" /> {booking.return_time || ""}
            </p>
          </div>
        </div>

        {/* Location row */}
        {(pu || rt) && (
          <div className="mt-2.5 flex items-start gap-2 text-[11.5px] text-muted-foreground">
            {pu?.isAirport || rt?.isAirport ? (
              <Plane className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
            ) : (
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
            )}
            <div className="min-w-0 flex-1 leading-snug">
              {sameLoc && pu ? (
                <span className="truncate block">
                  <span className="text-foreground/80">{pu.short}</span>
                  {pu.terminal && <span className="text-muted-foreground"> · {pu.terminal}</span>}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 truncate">
                  <span className="truncate text-foreground/80">{pu?.short || ""}</span>
                  <ArrowLeftRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <span className="truncate text-foreground/80">{rt?.short || ""}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Progress row (only when running) */}
        {showProgress && (
          <div className="mt-3">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${meta.bar_fill} transition-all duration-500`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>Em curso</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}
      </div>

      {/* chevron tap affordance */}
      <ChevronRight
        aria-hidden
        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40"
      />
    </button>
  );
}
