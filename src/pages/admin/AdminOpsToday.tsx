import { formatPersonName } from "@/lib/formatName";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarCheck, CalendarX2, Wrench, Car, MapPin, ChevronRight, Sun,
  Clock, ChevronDown, ChevronLeft, CalendarDays,
} from "lucide-react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
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

type OpsStatus = "completed" | "late" | "cancelled" | "pending";

const STATUS_META: Record<OpsStatus, { label: string; bar: string; dot: string; chipBg: string; chipText: string; chipBorder: string }> = {
  completed: {
    label: "Concluídas",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    chipBg: "bg-emerald-500/10",
    chipText: "text-emerald-600 dark:text-emerald-400",
    chipBorder: "border-emerald-500/30",
  },
  late: {
    label: "Atrasadas",
    bar: "bg-red-500",
    dot: "bg-red-500",
    chipBg: "bg-red-500/10",
    chipText: "text-red-600 dark:text-red-400",
    chipBorder: "border-red-500/30",
  },
  pending: {
    label: "Pendentes",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    chipBg: "bg-amber-500/10",
    chipText: "text-amber-600 dark:text-amber-400",
    chipBorder: "border-amber-500/30",
  },
  cancelled: {
    label: "Canceladas",
    bar: "bg-muted-foreground/50",
    dot: "bg-muted-foreground/60",
    chipBg: "bg-muted",
    chipText: "text-muted-foreground",
    chipBorder: "border-border",
  },
};

function deriveStatus(b: BookingRow, kind: "pickup" | "return", now: Date): OpsStatus {
  if (b.status === "cancelled") return "cancelled";
  if (kind === "pickup") {
    if (["active", "in_progress", "completed"].includes(b.status)) return "completed";
    const t = b.pickup_time ? b.pickup_time.slice(0, 5) : "23:59";
    const dt = new Date(`${b.pickup_date}T${t}:00`);
    if (dt.getTime() < now.getTime()) return "late";
    return "pending";
  } else {
    if (b.status === "completed") return "completed";
    const t = b.return_time ? b.return_time.slice(0, 5) : "23:59";
    const dt = new Date(`${b.return_date}T${t}:00`);
    if (dt.getTime() < now.getTime()) return "late";
    return "pending";
  }
}

export default function AdminOpsToday() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [pickups, setPickups] = useState<BookingRow[]>([]);
  const [returns, setReturns] = useState<BookingRow[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [maintenance, setMaintenance] = useState<Vehicle[]>([]);
  const [showAllPrep, setShowAllPrep] = useState(false);
  const [pickupFilter, setPickupFilter] = useState<OpsStatus | "all">("all");
  const [returnFilter, setReturnFilter] = useState<OpsStatus | "all">("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const dayStr = format(selectedDate, "yyyy-MM-dd");
      const [pk, rt, vs] = await Promise.all([
        supabase.from("bookings")
          .select("id, customer_name, customer_phone, pickup_date, return_date, pickup_time, return_time, pickup_location, return_location, vehicle_id, status, booking_number")
          .eq("pickup_date", dayStr)
          .in("status", ["pending", "confirmed", "active", "in_progress", "completed", "cancelled"])
          .order("pickup_time"),
        supabase.from("bookings")
          .select("id, customer_name, customer_phone, pickup_date, return_date, pickup_time, return_time, pickup_location, return_location, vehicle_id, status, booking_number")
          .eq("return_date", dayStr)
          .in("status", ["confirmed", "active", "in_progress", "completed", "cancelled"])
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
  }, [selectedDate]);

  const isToday = isSameDay(selectedDate, new Date());
  const dayLabel = format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const weekdayLabel = format(selectedDate, "EEEE", { locale: ptBR });
  const now = new Date();

  const pickupsWithStatus = useMemo(
    () => pickups.map(b => ({ b, s: deriveStatus(b, "pickup", now) })),
    [pickups, now],
  );
  const returnsWithStatus = useMemo(
    () => returns.map(b => ({ b, s: deriveStatus(b, "return", now) })),
    [returns, now],
  );

  const countBy = (arr: { s: OpsStatus }[]) => {
    const c: Record<OpsStatus, number> = { completed: 0, late: 0, pending: 0, cancelled: 0 };
    arr.forEach(({ s }) => { c[s]++; });
    return c;
  };
  const pickupCounts = countBy(pickupsWithStatus);
  const returnCounts = countBy(returnsWithStatus);

  const filteredPickups = pickupFilter === "all"
    ? pickupsWithStatus
    : pickupsWithStatus.filter(x => x.s === pickupFilter);
  const filteredReturns = returnFilter === "all"
    ? returnsWithStatus
    : returnsWithStatus.filter(x => x.s === returnFilter);


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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <PrepCategory
                title="Em manutenção"
                tone="amber"
                vehicles={prepGroups.maintenance}
                expanded={showAllPrep}
                onNavigate={(id) => navigate(`/admin/fleet/${id}`)}
              />
              <PrepCategory
                title="Em preparação"
                tone="sky"
                vehicles={prepGroups.preparing}
                expanded={showAllPrep}
                onNavigate={(id) => navigate(`/admin/fleet/${id}`)}
              />
              {(prepGroups.maintenance.length > 8 || prepGroups.preparing.length > 8) && (
                <button
                  onClick={() => setShowAllPrep(!showAllPrep)}
                  className="md:col-span-2 mt-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 transition-colors inline-flex items-center justify-center gap-1"
                >
                  {showAllPrep ? "Recolher" : `Ver todos (${maintenance.length})`}
                  <ChevronDown size={12} className={showAllPrep ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
              )}
            </div>
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

  const brand = vehicle?.name?.split(" ")[0];
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border/40 bg-background/80 backdrop-blur-sm hover:bg-background hover:border-border/70 hover:shadow-md transition-all group relative overflow-hidden"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} />
      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start gap-3">
          {vehicle && (
            <BrandAvatar brand={brand} name={vehicle.name} size={36} />
          )}
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

function PrepCategory({
  title, tone, vehicles, expanded, onNavigate,
}: {
  title: string;
  tone: "amber" | "sky";
  vehicles: Vehicle[];
  expanded: boolean;
  onNavigate: (id: string) => void;
}) {
  const dot = tone === "amber" ? "bg-amber-500" : "bg-sky-500";
  const text = tone === "amber"
    ? "text-amber-600 dark:text-amber-400"
    : "text-sky-600 dark:text-sky-400";
  const visible = expanded ? vehicles : vehicles.slice(0, 8);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <h3 className={`text-[11px] font-bold uppercase tracking-[0.14em] ${text}`}>
          {title}
        </h3>
        <span className={`text-[11px] font-bold tabular-nums ${text}`}>
          {vehicles.length}
        </span>
      </div>
      {vehicles.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic pl-3.5">Nenhum veículo nesta categoria.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visible.map(v => {
            const brand = v.name.split(" ")[0];
            return (
              <button
                key={v.id}
                onClick={() => onNavigate(v.id)}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/70 hover:bg-background hover:border-border/70 hover:shadow-sm pl-1 pr-2.5 py-1 transition-all"
              >
                <BrandAvatar brand={brand} name={v.name} size={20} />
                <span className="text-xs font-medium text-foreground truncate max-w-[160px] group-hover:text-primary">
                  {v.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
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

/* ─────────────── decorative backdrops (discreet) ─────────────── */

function SunriseBackdrop() {
  return <CityPalmsBackdrop tone="emerald" />;
}

function SunsetBackdrop() {
  return <CityPalmsBackdrop tone="amber" />;
}

/**
 * Discreet horizon scene: faint city skyline, palms, a few birds and a small
 * car silhouette — anchored to the bottom of the card.
 */
function CityPalmsBackdrop({ tone }: { tone: "emerald" | "amber" }) {
  const color = tone === "emerald"
    ? "text-emerald-500/[0.09] dark:text-emerald-400/[0.09]"
    : "text-amber-500/[0.09] dark:text-amber-400/[0.09]";
  return (
    <svg
      className={`absolute left-0 right-0 bottom-0 w-full ${color} pointer-events-none`}
      viewBox="0 0 600 180" preserveAspectRatio="xMidYMax slice" fill="currentColor" aria-hidden="true"
    >
      {/* distant skyline */}
      <g>
        <rect x="40" y="110" width="14" height="60" />
        <rect x="58" y="95" width="20" height="75" />
        <rect x="82" y="118" width="12" height="52" />
        <rect x="98" y="88" width="22" height="82" />
        <rect x="120" y="118" width="3" height="20" />{/* antenna */}
        <rect x="124" y="105" width="14" height="65" />
        <rect x="142" y="120" width="18" height="50" />
        <rect x="164" y="100" width="16" height="70" />
        <rect x="184" y="115" width="12" height="55" />
        <rect x="200" y="92" width="22" height="78" />
        <rect x="226" y="112" width="14" height="58" />
        <rect x="244" y="122" width="18" height="48" />
      </g>
      {/* birds */}
      <g>
        <path d="M250 38 q 4 -4 8 0 q 4 -4 8 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M275 50 q 3 -3 6 0 q 3 -3 6 0" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M305 32 q 4 -4 8 0 q 4 -4 8 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </g>
      {/* palms (front, varied heights) */}
      <g>
        {/* tall palm */}
        <rect x="335" y="80" width="3" height="90" />
        <path d="M336.5 80 q -22 -8 -34 -1 q 20 -2 32 7 z" />
        <path d="M336.5 80 q 22 -8 34 -1 q -20 -2 -32 7 z" />
        <path d="M336.5 80 q -6 -20 -2 -32 q 7 16 7 32 z" />
        <path d="M336.5 80 q 6 -20 2 -32 q -7 16 -7 32 z" />
        {/* medium palm */}
        <rect x="395" y="100" width="3" height="70" />
        <path d="M396.5 100 q -18 -6 -28 -1 q 16 -2 26 6 z" />
        <path d="M396.5 100 q 18 -6 28 -1 q -16 -2 -26 6 z" />
        <path d="M396.5 100 q -5 -16 -1 -26 q 6 12 6 26 z" />
        {/* smaller palm */}
        <rect x="450" y="115" width="3" height="55" />
        <path d="M451.5 115 q -14 -5 -22 -1 q 12 -1 20 5 z" />
        <path d="M451.5 115 q 14 -5 22 -1 q -12 -1 -20 5 z" />
        <path d="M451.5 115 q -4 -12 -1 -20 q 5 10 5 20 z" />
        {/* far right palm */}
        <rect x="540" y="105" width="3" height="65" />
        <path d="M541.5 105 q -16 -6 -26 -1 q 14 -2 24 6 z" />
        <path d="M541.5 105 q 16 -6 26 -1 q -14 -2 -24 6 z" />
        <path d="M541.5 105 q -5 -14 -1 -24 q 5 11 5 24 z" />
      </g>
      {/* tiny car silhouette near horizon */}
      <g>
        <path d="M470 158 q 3 -8 10 -8 l 36 0 q 6 0 9 4 l 6 4 l 10 0 q 4 0 4 4 l 0 3 l -78 0 l 0 -4 q 0 -1 3 -3 z" />
      </g>
    </svg>
  );
}

/** Discreet wrench mark on the right side of the prep strip */
function GarageBackdrop() {
  return (
    <svg
      className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-500/[0.07] dark:text-sky-400/[0.07] pointer-events-none"
      width="80" height="80" viewBox="0 0 80 80" fill="currentColor" aria-hidden="true"
    >
      <path d="M14 64 l 28 -28 a 18 18 0 1 1 10 10 l -28 28 z" />
    </svg>
  );
}

