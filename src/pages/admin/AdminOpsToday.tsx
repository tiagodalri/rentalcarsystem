import { formatPersonName } from "@/lib/formatName";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarCheck, CalendarX2, Wrench, Car, MapPin, ChevronRight, Sun,
  Clock, ChevronDown, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BrandAvatar } from "@/components/admin/fleet-calendar/BrandAvatar";

type BookingRow = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  pickup_date: string;
  return_date: string;
  pickup_time: string | null;
  return_time: string | null;
  pickup_location: string | null;
  return_location: string | null;
  vehicle_id: string;
  status: string;
  booking_number: string | null;
};

type Vehicle = { id: string; name: string; status: string; brand?: string | null };

export default function AdminOpsToday() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pickups, setPickups] = useState<BookingRow[]>([]);
  const [returns, setReturns] = useState<BookingRow[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [maintenance, setMaintenance] = useState<Vehicle[]>([]);
  const [showAllPrep, setShowAllPrep] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const today = format(new Date(), "yyyy-MM-dd");
      const [pk, rt, vs] = await Promise.all([
        supabase.from("bookings")
          .select("id, customer_name, customer_phone, pickup_date, return_date, pickup_time, return_time, pickup_location, return_location, vehicle_id, status, booking_number")
          .eq("pickup_date", today)
          .in("status", ["pending", "confirmed", "active", "in_progress"])
          .order("pickup_time"),
        supabase.from("bookings")
          .select("id, customer_name, customer_phone, pickup_date, return_date, pickup_time, return_time, pickup_location, return_location, vehicle_id, status, booking_number")
          .eq("return_date", today)
          .in("status", ["confirmed", "active", "in_progress"])
          .order("return_time"),
        supabase.from("vehicles").select("id, name, status"),
      ]);

      const vMap: Record<string, Vehicle> = {};
      (vs.data || []).forEach((v: any) => { vMap[v.id] = v; });
      setVehicles(vMap);
      setPickups((pk.data as BookingRow[]) || []);
      setReturns((rt.data as BookingRow[]) || []);
      setMaintenance(((vs.data as Vehicle[]) || []).filter(v => ["maintenance", "preparing"].includes(v.status)));
      setLoading(false);
    })();
  }, []);

  const today = new Date();
  const dayLabel = format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const weekdayLabel = format(today, "EEEE", { locale: ptBR });

  if (loading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Carregando operação do dia...</div>;
  }

  return (
    <div className="space-y-5">
      {/* ────────── HEADER ────────── */}
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-1.5 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-emerald-600 dark:text-emerald-400">
              Painel de operação · ao vivo
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            <span className="capitalize">{dayLabel}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{weekdayLabel}</p>
        </div>

        {/* Compact KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 xl:min-w-[640px]">
          <KpiCard
            icon={<CalendarCheck size={18} className="text-emerald-600 dark:text-emerald-400" />}
            iconBg="bg-emerald-500/15"
            label="Retiradas"
            value={pickups.length}
            valueColor="text-emerald-600 dark:text-emerald-400"
            sub={pickups.length === 1 ? "programada para hoje" : "programadas para hoje"}
            waveColor="text-emerald-500/15"
          />
          <KpiCard
            icon={<CalendarX2 size={18} className="text-amber-600 dark:text-amber-400" />}
            iconBg="bg-amber-500/15"
            label="Devoluções"
            value={returns.length}
            valueColor="text-amber-600 dark:text-amber-400"
            sub={returns.length === 1 ? "programada para hoje" : "programadas para hoje"}
            waveColor="text-amber-500/15"
          />
          <KpiCard
            icon={<Wrench size={18} className="text-sky-600 dark:text-sky-400" />}
            iconBg="bg-sky-500/15"
            label="Em preparação"
            value={maintenance.length}
            valueColor="text-sky-600 dark:text-sky-400"
            sub={maintenance.length === 1 ? "carro em preparação" : "carros em preparação"}
            waveColor="text-sky-500/15"
          />
        </div>
      </div>

      {/* ────────── PICKUPS + RETURNS (in evidence) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* RETIRADAS */}
        <SectionCard
          icon={<CalendarCheck size={18} />}
          iconBg="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          title="Retiradas de hoje"
          titleColor="text-emerald-600 dark:text-emerald-400"
          accentColor="bg-emerald-500"
          count={pickups.length}
          countColor="text-emerald-600 dark:text-emerald-400"
          backdrop={<SunriseBackdrop />}
        >
          {pickups.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck size={26} />}
              tone="emerald"
              title="Nenhuma retirada hoje."
              subtitle="Aproveite para preparar o resto da frota."
            />
          ) : (
            <div className="space-y-3">
              {pickups.map(b => (
                <BookingRowCard
                  key={b.id}
                  booking={b}
                  vehicle={vehicles[b.vehicle_id]}
                  type="pickup"
                  onClick={() => navigate(`/admin/bookings/${b.id}`)}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* DEVOLUÇÕES */}
        <SectionCard
          icon={<CalendarX2 size={18} />}
          iconBg="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          title="Devoluções de hoje"
          titleColor="text-amber-600 dark:text-amber-400"
          accentColor="bg-amber-500"
          count={returns.length}
          countColor="text-amber-600 dark:text-amber-400"
          backdrop={<SunsetBackdrop />}
        >
          {returns.length === 0 ? (
            <EmptyState
              icon={<CalendarX2 size={26} />}
              tone="amber"
              title="Nenhuma devolução prevista hoje."
              subtitle="Ótimo! Nenhuma devolução agendada."
            />
          ) : (
            <div className="space-y-3">
              {returns.map(b => (
                <BookingRowCard
                  key={b.id}
                  booking={b}
                  vehicle={vehicles[b.vehicle_id]}
                  type="return"
                  onClick={() => navigate(`/admin/bookings/${b.id}`)}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ────────── EM PREPARAÇÃO (compact bottom strip ~20%) ────────── */}
      <div className="relative rounded-2xl border border-border/40 bg-gradient-to-r from-sky-500/[0.04] via-card/60 to-card/60 overflow-hidden">
        <GarageBackdrop />
        <div className="relative z-10 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Wrench size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-sky-600 dark:text-sky-400">
                  Em preparação
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Veículos sendo higienizados ou em manutenção
                </p>
              </div>
            </div>
            <span className="text-base font-bold tabular-nums text-sky-600 dark:text-sky-400 shrink-0">
              {maintenance.length}
            </span>
          </div>

          {maintenance.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Frota toda pronta para circular.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(showAllPrep ? maintenance : maintenance.slice(0, 12)).map(v => (
                  <button
                    key={v.id}
                    onClick={() => navigate(`/admin/fleet/${v.id}`)}
                    className="group inline-flex items-center gap-2 rounded-full border border-border/40 bg-background/70 hover:bg-background hover:border-border/70 hover:shadow-sm pl-2 pr-3 py-1.5 transition-all"
                  >
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                      v.status === "maintenance"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                    }`}>
                      <Car size={11} />
                    </span>
                    <span className="text-xs font-medium text-foreground truncate max-w-[160px] group-hover:text-primary">
                      {v.name}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                      v.status === "maintenance"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-sky-600 dark:text-sky-400"
                    }`}>
                      {v.status === "maintenance" ? "Manut." : "Prep."}
                    </span>
                  </button>
                ))}
              </div>
              {maintenance.length > 12 && (
                <button
                  onClick={() => setShowAllPrep(!showAllPrep)}
                  className="mt-3 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 transition-colors inline-flex items-center gap-1"
                >
                  {showAllPrep ? "Recolher" : `Ver todos (${maintenance.length})`}
                  <ChevronDown size={12} className={showAllPrep ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ────────── FOOTER TIPS ────────── */}
      <div className="rounded-xl border border-border/40 bg-card/40 p-4 flex flex-col sm:flex-row gap-4 sm:gap-8">
        <div className="flex items-start gap-3 flex-1">
          <div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Clock size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Fique atento aos horários</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mantenha as retiradas em dia e garanta a melhor experiência para seus clientes.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 flex-1">
          <div className="h-9 w-9 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <Sun size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Bom dia.</p>
            <p className="text-xs text-muted-foreground mt-0.5">Tenha uma operação excelente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── components ─────────────── */

function KpiCard({
  icon, iconBg, label, value, valueColor, sub, waveColor,
}: {
  icon: React.ReactNode; iconBg: string; label: string; value: number;
  valueColor: string; sub: string; waveColor: string;
}) {
  return (
    <div className="relative rounded-xl border border-border/40 bg-card/80 p-3.5 overflow-hidden">
      <div className="flex items-center gap-3 relative z-10">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground">
            {label}
          </p>
          <p className={`text-2xl font-bold tabular-nums leading-none mt-0.5 ${valueColor}`}>
            {value}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 relative z-10">{sub}</p>
      {/* decorative wave */}
      <svg
        className={`absolute -right-2 -bottom-1 ${waveColor}`}
        width="110" height="40" viewBox="0 0 110 40" fill="none"
        aria-hidden="true"
      >
        <path d="M0 30 Q 27 10 55 20 T 110 18 L 110 40 L 0 40 Z" fill="currentColor" />
      </svg>
    </div>
  );
}

function SectionCard({
  className = "", icon, iconBg, title, titleColor, accentColor, count, countColor, children, backdrop,
}: {
  className?: string; icon: React.ReactNode; iconBg: string; title: string;
  titleColor: string; accentColor: string; count: number; countColor: string;
  children: React.ReactNode; backdrop?: React.ReactNode;
}) {
  return (
    <div className={`relative rounded-2xl border border-border/40 bg-card/60 p-5 overflow-hidden flex flex-col min-h-[460px] ${className}`}>
      {backdrop}
      <div className="flex items-start justify-between gap-2 mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
          <div>
            <h2 className={`text-sm font-bold uppercase tracking-[0.1em] ${titleColor}`}>
              {title}
            </h2>
            <div className={`mt-1 h-0.5 w-10 rounded-full ${accentColor}`} />
          </div>
        </div>
        <span className={`text-base font-bold tabular-nums ${countColor}`}>{count}</span>
      </div>
      <div className="flex-1 relative z-10">{children}</div>
    </div>
  );
}

function BookingRowCard({
  booking, vehicle, type, onClick,
}: {
  booking: BookingRow; vehicle?: Vehicle; type: "pickup" | "return"; onClick: () => void;
}) {
  const time = type === "pickup" ? booking.pickup_time : booking.return_time;
  const loc = type === "pickup" ? booking.pickup_location : booking.return_location;
  const accent = type === "pickup" ? "bg-emerald-500" : "bg-amber-500";
  const badge = type === "pickup"
    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    : "bg-amber-500/15 text-amber-600 dark:text-amber-400";

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border/40 bg-background/80 backdrop-blur-sm hover:bg-background hover:border-border/70 hover:shadow-md transition-all group relative overflow-hidden"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} />
      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-bold tabular-nums text-foreground leading-none">
                {time ? time.slice(0, 5) : "—"}
              </span>
              <span className="text-sm font-semibold text-foreground truncate">
                {formatPersonName(booking.customer_name)}
              </span>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Car size={11} className="shrink-0" />
                <span className="truncate">{vehicle?.name || "—"}</span>
              </div>
              {loc && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin size={11} className="shrink-0" />
                  <span className="truncate">{loc}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {booking.booking_number && (
              <span className={`text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-md font-semibold ${badge}`}>
                {booking.booking_number}
              </span>
            )}
            <ChevronRight size={14} className="text-muted-foreground/60 group-hover:text-foreground transition-colors" />
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyState({
  icon, tone, title, subtitle,
}: {
  icon: React.ReactNode; tone: "emerald" | "amber" | "sky"; title: string; subtitle: string;
}) {
  const map = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  };
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className={`h-14 w-14 rounded-full flex items-center justify-center mb-4 ${map[tone]}`}>
        {icon}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

/* ─────────────── decorative backdrops ─────────────── */

/** Morning scene: sun rising, clouds, road, palms — for Pickups card */
function SunriseBackdrop() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 600 460" preserveAspectRatio="xMidYMax slice" aria-hidden="true"
    >
      {/* soft sky glow */}
      <defs>
        <radialGradient id="sunriseGlow" cx="80%" cy="22%" r="40%">
          <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="460" fill="url(#sunriseGlow)" />
      {/* sun */}
      <circle cx="500" cy="90" r="34" className="fill-emerald-400/15" />
      <circle cx="500" cy="90" r="22" className="fill-emerald-400/25" />
      {/* clouds */}
      <g className="fill-emerald-500/10 dark:fill-emerald-400/10">
        <ellipse cx="120" cy="70" rx="28" ry="8" />
        <ellipse cx="150" cy="78" rx="22" ry="7" />
        <ellipse cx="370" cy="55" rx="34" ry="8" />
        <ellipse cx="405" cy="62" rx="20" ry="6" />
      </g>
      {/* horizon road */}
      <g className="fill-emerald-500/12 dark:fill-emerald-400/12">
        <path d="M0 410 L 600 410 L 600 420 L 0 420 Z" />
        {/* dashed center line */}
        <rect x="40" y="414" width="30" height="2" />
        <rect x="100" y="414" width="30" height="2" />
        <rect x="160" y="414" width="30" height="2" />
        <rect x="220" y="414" width="30" height="2" />
        <rect x="280" y="414" width="30" height="2" />
        <rect x="340" y="414" width="30" height="2" />
        <rect x="400" y="414" width="30" height="2" />
        <rect x="460" y="414" width="30" height="2" />
        <rect x="520" y="414" width="30" height="2" />
      </g>
      {/* palms */}
      <g className="fill-emerald-500/12 dark:fill-emerald-400/12">
        <rect x="36" y="350" width="3" height="60" />
        <path d="M37 350 q -20 -10 -32 -3 q 18 -2 30 7 z" />
        <path d="M37 350 q 22 -10 34 -3 q -18 -2 -30 7 z" />
        <path d="M37 350 q -6 -18 -2 -30 q 7 14 7 30 z" />
        <rect x="560" y="360" width="3" height="50" />
        <path d="M561 360 q -16 -8 -26 -2 q 14 -2 24 6 z" />
        <path d="M561 360 q 18 -8 28 -2 q -14 -2 -26 6 z" />
        <path d="M561 360 q -5 -14 -1 -24 q 6 12 6 24 z" />
      </g>
      {/* tiny car silhouette */}
      <g className="fill-emerald-500/14 dark:fill-emerald-400/14">
        <path d="M260 400 q 4 -12 14 -12 l 50 0 q 8 0 12 6 l 8 6 l 14 0 q 6 0 6 6 l 0 4 l -110 0 l 0 -6 q 0 -2 6 -4 z" />
        <circle cx="282" cy="410" r="4" />
        <circle cx="346" cy="410" r="4" />
      </g>
    </svg>
  );
}

/** Evening scene: setting sun, longer shadows — for Returns card */
function SunsetBackdrop() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 600 460" preserveAspectRatio="xMidYMax slice" aria-hidden="true"
    >
      <defs>
        <radialGradient id="sunsetGlow" cx="18%" cy="25%" r="42%">
          <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="460" fill="url(#sunsetGlow)" />
      {/* low sun */}
      <circle cx="90" cy="110" r="36" className="fill-amber-400/15" />
      <circle cx="90" cy="110" r="22" className="fill-amber-400/25" />
      {/* clouds */}
      <g className="fill-amber-500/10 dark:fill-amber-400/10">
        <ellipse cx="220" cy="60" rx="30" ry="7" />
        <ellipse cx="255" cy="68" rx="20" ry="6" />
        <ellipse cx="450" cy="80" rx="34" ry="8" />
        <ellipse cx="490" cy="88" rx="20" ry="6" />
      </g>
      {/* skyline silhouettes */}
      <g className="fill-amber-500/10 dark:fill-amber-400/10">
        <rect x="380" y="350" width="14" height="60" />
        <rect x="398" y="335" width="20" height="75" />
        <rect x="422" y="360" width="12" height="50" />
        <rect x="438" y="320" width="22" height="90" />
        <rect x="464" y="345" width="14" height="65" />
        <rect x="482" y="360" width="18" height="50" />
      </g>
      {/* horizon road */}
      <g className="fill-amber-500/12 dark:fill-amber-400/12">
        <path d="M0 410 L 600 410 L 600 420 L 0 420 Z" />
        <rect x="40" y="414" width="30" height="2" />
        <rect x="100" y="414" width="30" height="2" />
        <rect x="160" y="414" width="30" height="2" />
        <rect x="220" y="414" width="30" height="2" />
        <rect x="280" y="414" width="30" height="2" />
        <rect x="340" y="414" width="30" height="2" />
        <rect x="400" y="414" width="30" height="2" />
        <rect x="460" y="414" width="30" height="2" />
        <rect x="520" y="414" width="30" height="2" />
      </g>
      {/* palm */}
      <g className="fill-amber-500/12 dark:fill-amber-400/12">
        <rect x="540" y="350" width="3" height="60" />
        <path d="M541 350 q -20 -10 -32 -3 q 18 -2 30 7 z" />
        <path d="M541 350 q 22 -10 34 -3 q -18 -2 -30 7 z" />
        <path d="M541 350 q -6 -18 -2 -30 q 7 14 7 30 z" />
      </g>
      {/* car returning */}
      <g className="fill-amber-500/14 dark:fill-amber-400/14">
        <path d="M150 400 q 4 -12 14 -12 l 50 0 q 8 0 12 6 l 8 6 l 14 0 q 6 0 6 6 l 0 4 l -110 0 l 0 -6 q 0 -2 6 -4 z" />
        <circle cx="172" cy="410" r="4" />
        <circle cx="236" cy="410" r="4" />
      </g>
    </svg>
  );
}

/** Garage scene watermark for prep strip */
function GarageBackdrop() {
  return (
    <svg
      className="absolute inset-0 w-full h-full text-sky-500/[0.07] dark:text-sky-400/[0.07] pointer-events-none"
      viewBox="0 0 800 160" preserveAspectRatio="xMidYMid slice" fill="currentColor" aria-hidden="true"
    >
      {/* gears */}
      <g transform="translate(720,80)">
        <circle r="22" />
        <circle r="10" className="fill-background" />
        <g>
          <rect x="-3" y="-30" width="6" height="8" />
          <rect x="-3" y="22" width="6" height="8" />
          <rect x="-30" y="-3" width="8" height="6" />
          <rect x="22" y="-3" width="8" height="6" />
        </g>
      </g>
      {/* wrench */}
      <path d="M30 110 l 18 -18 a 14 14 0 1 1 8 8 l -18 18 z" />
      {/* dashed road on bottom */}
      <rect x="0" y="148" width="800" height="3" />
      <rect x="60" y="150" width="24" height="1.5" />
      <rect x="120" y="150" width="24" height="1.5" />
      <rect x="180" y="150" width="24" height="1.5" />
      <rect x="240" y="150" width="24" height="1.5" />
      <rect x="300" y="150" width="24" height="1.5" />
      <rect x="360" y="150" width="24" height="1.5" />
      <rect x="420" y="150" width="24" height="1.5" />
      <rect x="480" y="150" width="24" height="1.5" />
      <rect x="540" y="150" width="24" height="1.5" />
      <rect x="600" y="150" width="24" height="1.5" />
      <rect x="660" y="150" width="24" height="1.5" />
    </svg>
  );
}
