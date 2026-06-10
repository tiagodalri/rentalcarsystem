import { formatPersonName } from "@/lib/formatName";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarCheck, CalendarX2, Wrench, Car, MapPin, ChevronRight, Sun,
  Clock, ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

type Vehicle = { id: string; name: string; status: string };

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
              Operação de hoje
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

      {/* ────────── 3-COLUMN GRID ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* RETIRADAS */}
        <SectionCard
          className="lg:col-span-4"
          icon={<CalendarCheck size={18} />}
          iconBg="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          title="Retiradas de hoje"
          titleColor="text-emerald-600 dark:text-emerald-400"
          accentColor="bg-emerald-500"
          count={pickups.length}
          countColor="text-emerald-600 dark:text-emerald-400"
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
          <CityBackdrop tone="emerald" />
        </SectionCard>

        {/* DEVOLUÇÕES */}
        <SectionCard
          className="lg:col-span-4"
          icon={<CalendarX2 size={18} />}
          iconBg="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          title="Devoluções de hoje"
          titleColor="text-amber-600 dark:text-amber-400"
          accentColor="bg-amber-500"
          count={returns.length}
          countColor="text-amber-600 dark:text-amber-400"
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
          <CityBackdrop tone="amber" />
        </SectionCard>

        {/* EM PREPARAÇÃO */}
        <SectionCard
          className="lg:col-span-4"
          icon={<Wrench size={18} />}
          iconBg="bg-sky-500/15 text-sky-600 dark:text-sky-400"
          title="Em preparação"
          titleColor="text-sky-600 dark:text-sky-400"
          accentColor="bg-sky-500"
          count={maintenance.length}
          countColor="text-sky-600 dark:text-sky-400"
        >
          {maintenance.length === 0 ? (
            <EmptyState
              icon={<Wrench size={26} />}
              tone="sky"
              title="Nenhum carro em preparação."
              subtitle="Frota toda pronta para circular."
            />
          ) : (
            <>
              <ul className="divide-y divide-border/40">
                {(showAllPrep ? maintenance : maintenance.slice(0, 10)).map(v => (
                  <li
                    key={v.id}
                    onClick={() => navigate(`/admin/fleet/${v.id}`)}
                    className="flex items-center justify-between py-2.5 cursor-pointer group hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Car size={15} className="text-sky-500 shrink-0" />
                      <span className="text-sm text-foreground font-medium truncate group-hover:text-primary">
                        {v.name}
                      </span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider shrink-0 ${
                      v.status === "maintenance"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                    }`}>
                      {v.status === "maintenance" ? "Manutenção" : "Preparando"}
                    </span>
                  </li>
                ))}
              </ul>
              {maintenance.length > 10 && (
                <button
                  onClick={() => setShowAllPrep(!showAllPrep)}
                  className="w-full pt-3 mt-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 transition-colors flex items-center justify-center gap-1"
                >
                  {showAllPrep ? "Recolher" : "Ver todos"}
                  <ChevronDown size={12} className={showAllPrep ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
              )}
            </>
          )}
        </SectionCard>
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
  className = "", icon, iconBg, title, titleColor, accentColor, count, countColor, children,
}: {
  className?: string; icon: React.ReactNode; iconBg: string; title: string;
  titleColor: string; accentColor: string; count: number; countColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative rounded-2xl border border-border/40 bg-card/60 p-5 overflow-hidden flex flex-col min-h-[420px] ${className}`}>
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
      className="w-full text-left rounded-xl border border-border/40 bg-background/70 hover:bg-background hover:border-border/70 hover:shadow-sm transition-all group relative overflow-hidden"
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

/** Subtle Orlando-skyline + palm silhouette decoration anchored at the card bottom. */
function CityBackdrop({ tone }: { tone: "emerald" | "amber" }) {
  const color = tone === "emerald"
    ? "text-emerald-500/10 dark:text-emerald-400/10"
    : "text-amber-500/10 dark:text-amber-400/10";
  return (
    <svg
      className={`absolute left-0 right-0 bottom-0 w-full ${color} pointer-events-none`}
      viewBox="0 0 400 90" preserveAspectRatio="none" fill="currentColor" aria-hidden="true"
    >
      {/* skyline */}
      <rect x="20" y="40" width="14" height="50" />
      <rect x="38" y="28" width="20" height="62" />
      <rect x="62" y="46" width="12" height="44" />
      <rect x="78" y="20" width="22" height="70" />
      <rect x="104" y="38" width="14" height="52" />
      <rect x="122" y="50" width="18" height="40" />
      <rect x="144" y="34" width="16" height="56" />
      <rect x="164" y="44" width="12" height="46" />
      <rect x="180" y="26" width="22" height="64" />
      <rect x="206" y="42" width="14" height="48" />
      {/* ground line */}
      <rect x="0" y="86" width="400" height="4" />
      {/* palm tree trunks */}
      <rect x="320" y="40" width="3" height="50" />
      <rect x="358" y="50" width="3" height="40" />
      {/* palm fronds */}
      <path d="M321 40 q -18 -8 -28 -2 q 14 -2 26 6 z" />
      <path d="M321 40 q 18 -8 28 -2 q -14 -2 -26 6 z" />
      <path d="M321 40 q -6 -16 -2 -26 q 6 12 6 26 z" />
      <path d="M359 50 q -14 -6 -22 -1 q 11 -1 20 5 z" />
      <path d="M359 50 q 14 -6 22 -1 q -11 -1 -20 5 z" />
      <path d="M359 50 q -4 -12 -1 -20 q 5 9 5 20 z" />
    </svg>
  );
}
