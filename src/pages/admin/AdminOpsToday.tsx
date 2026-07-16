import { formatPersonName } from "@/lib/formatName";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarCheck, CalendarX2, Wrench, Car, MapPin, ChevronRight, Sun,
  Clock, ChevronDown, ChevronLeft, CalendarDays, Play, Calendar as CalendarIcon,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { BrandAvatar } from "@/components/admin/fleet-calendar/BrandAvatar";
import { LoadingRows } from "@/components/skeletons/LoadingRows";

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

function deriveStatus(
  b: BookingRow,
  kind: "pickup" | "return",
  now: Date,
  inspectionDone: { checkin: boolean; checkout: boolean },
): OpsStatus {
  if (b.status === "cancelled") return "cancelled";
  if (kind === "pickup") {
    if (["active", "in_progress", "completed"].includes(b.status)) return "completed";
    // Defesa: se a inspeção de retirada já foi finalizada, conta como concluída
    // mesmo que o status da reserva não tenha sido promovido por algum motivo.
    if (inspectionDone.checkin) return "completed";
    const t = b.pickup_time ? b.pickup_time.slice(0, 5) : "23:59";
    const dt = new Date(`${b.pickup_date}T${t}:00`);
    if (dt.getTime() < now.getTime()) return "late";
    return "pending";
  } else {
    if (b.status === "completed") return "completed";
    if (inspectionDone.checkout) return "completed";
    const t = b.return_time ? b.return_time.slice(0, 5) : "23:59";
    const dt = new Date(`${b.return_date}T${t}:00`);
    if (dt.getTime() < now.getTime()) return "late";
    return "pending";
  }
}

export default function AdminOpsToday() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickups, setPickups] = useState<BookingRow[]>([]);
  const [returns, setReturns] = useState<BookingRow[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [maintenance, setMaintenance] = useState<Vehicle[]>([]);
  const [inspectionMap, setInspectionMap] = useState<Record<string, { checkin: boolean; checkout: boolean }>>({});
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
          .is("deleted_at", null)
          .eq("pickup_date", dayStr)
          .in("status", ["pending", "confirmed", "active", "in_progress", "completed"])
          .order("pickup_time"),
        supabase.from("bookings")
          .select("id, customer_name, customer_phone, pickup_date, return_date, pickup_time, return_time, pickup_location, return_location, vehicle_id, status, booking_number")
          .is("deleted_at", null)
          .eq("return_date", dayStr)
          .in("status", ["confirmed", "active", "in_progress", "completed"])
          .order("return_time"),
        supabase.rpc("list_vehicles_basic"),
      ]);

      const vMap: Record<string, Vehicle> = {};
      (vs.data || []).forEach((v: any) => { vMap[v.id] = v; });
      setVehicles(vMap);
      const pickupRows = ((pk.data as BookingRow[]) || []).filter(b => b.status !== "cancelled");
      const returnRows = ((rt.data as BookingRow[]) || []).filter(b => b.status !== "cancelled");
      setPickups(pickupRows);
      setReturns(returnRows);
      setMaintenance(((vs.data as Vehicle[]) || []).filter(v => ["maintenance", "preparing"].includes(v.status)));

      // Carrega inspeções concluídas pra esses bookings — fallback caso o status
      // da reserva não tenha sido promovido (rede caindo no finalize etc.).
      const ids = Array.from(new Set([...pickupRows, ...returnRows].map(b => b.id)));
      if (ids.length) {
        const { data: insps } = await supabase
          .from("vehicle_inspections")
          .select("booking_id, type, completed_at")
          .in("booking_id", ids)
          .not("completed_at", "is", null);
        const map: Record<string, { checkin: boolean; checkout: boolean }> = {};
        (insps || []).forEach((i: any) => {
          if (!map[i.booking_id]) map[i.booking_id] = { checkin: false, checkout: false };
          if (i.type === "checkin") map[i.booking_id].checkin = true;
          if (i.type === "checkout") map[i.booking_id].checkout = true;
        });
        setInspectionMap(map);
      } else {
        setInspectionMap({});
      }
      setLoading(false);
    })();
  }, [selectedDate]);

  const isToday = isSameDay(selectedDate, new Date());
  const dayLabel = format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const weekdayLabel = format(selectedDate, "EEEE", { locale: ptBR });
  const now = new Date();

  const pickupsWithStatus = useMemo(
    () => pickups.map(b => ({ b, s: deriveStatus(b, "pickup", now, inspectionMap[b.id] ?? { checkin: false, checkout: false }) })),
    [pickups, now, inspectionMap],
  );
  const returnsWithStatus = useMemo(
    () => returns.map(b => ({ b, s: deriveStatus(b, "return", now, inspectionMap[b.id] ?? { checkin: false, checkout: false }) })),
    [returns, now, inspectionMap],
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

  const prepGroups = useMemo(() => ({
    maintenance: maintenance.filter(v => v.status === "maintenance"),
    preparing: maintenance.filter(v => v.status === "preparing"),
  }), [maintenance]);

  if (loading) {
    return <LoadingRows count={6} rowHeight={64} className="p-6" />;
  }


  return (
    <div className="space-y-3">

      {/* ────────── HEADER ────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 mb-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-emerald-600 dark:text-emerald-400">
              Painel de operação · {isToday ? "hoje" : "outro dia"}
            </span>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="admin-h1 text-2xl leading-none">
              <span className="capitalize">{dayLabel}</span>
            </h1>
            <p className="text-xs text-muted-foreground capitalize">{weekdayLabel}</p>
          </div>

          {/* Date navigation */}
          <div className="mt-2 inline-flex items-center gap-1 rounded-xl border border-border/50 bg-card/70 p-1 shadow-sm">
            <button
              onClick={() => setSelectedDate(d => addDays(d, -1))}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Dia anterior"
              title="Dia anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setSelectedDate(startOfDay(new Date()))}
              disabled={isToday}
              className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                isToday
                  ? "bg-muted text-muted-foreground cursor-default"
                  : "text-foreground hover:bg-muted"
              }`}
              title="Voltar para hoje"
            >
              <CalendarDays size={12} />
              {isToday ? "Hoje" : format(selectedDate, "dd 'de' MMM", { locale: ptBR })}
            </button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Selecionar data"
                  title="Selecionar data"
                >
                  <CalendarIcon size={14} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => {
                    if (d) {
                      setSelectedDate(startOfDay(d));
                      setCalendarOpen(false);
                    }
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <button
              onClick={() => setSelectedDate(d => addDays(d, 1))}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Próximo dia"
              title="Próximo dia"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Compact KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 xl:min-w-[560px]">
          <KpiCard
            icon={<CalendarCheck size={18} className="text-emerald-600 dark:text-emerald-400" />}
            iconBg="bg-emerald-500/15"
            label="Retiradas"
            value={pickups.length}
            valueColor="text-emerald-600 dark:text-emerald-400"
            sub={pickups.length === 1 ? "programada para o dia" : "programadas para o dia"}
            waveColor="text-emerald-500/15"
          />
          <KpiCard
            icon={<CalendarX2 size={18} className="text-amber-600 dark:text-amber-400" />}
            iconBg="bg-amber-500/15"
            label="Devoluções"
            value={returns.length}
            valueColor="text-amber-600 dark:text-amber-400"
            sub={returns.length === 1 ? "programada para o dia" : "programadas para o dia"}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* RETIRADAS */}
        <SectionCard
          icon={<CalendarCheck size={18} />}
          iconBg="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          title={isToday ? "Retiradas de hoje" : "Retiradas do dia"}
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
              title="Nenhuma retirada nesta data."
              subtitle="Aproveite para preparar o resto da frota."
            />
          ) : (
            <>
              <StatusLegend
                counts={pickupCounts}
                active={pickupFilter}
                onChange={setPickupFilter}
              />
              {filteredPickups.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-6 text-center">
                  Nenhuma retirada nesta categoria.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[calc(100vh-380px)] overflow-y-auto pr-1 -mr-1">
                  {filteredPickups.map(({ b, s }) => (
                    <BookingRowCard
                      key={b.id}
                      booking={b}
                      vehicle={vehicles[b.vehicle_id]}
                      type="pickup"
                      opsStatus={s}
                      onClick={() => navigate(`/admin/bookings/${b.id}`)}
                    />
                  ))}
                </div>

              )}
            </>
          )}
        </SectionCard>

        {/* DEVOLUÇÕES */}
        <SectionCard
          icon={<CalendarX2 size={18} />}
          iconBg="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          title={isToday ? "Devoluções de hoje" : "Devoluções do dia"}
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
              title="Nenhuma devolução prevista."
              subtitle="Nenhuma devolução agendada para esta data."
            />
          ) : (
            <>
              <StatusLegend
                counts={returnCounts}
                active={returnFilter}
                onChange={setReturnFilter}
              />
              {filteredReturns.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-6 text-center">
                  Nenhuma devolução nesta categoria.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[calc(100vh-380px)] overflow-y-auto pr-1 -mr-1">
                  {filteredReturns.map(({ b, s }) => (
                    <BookingRowCard
                      key={b.id}
                      booking={b}
                      vehicle={vehicles[b.vehicle_id]}
                      type="return"
                      opsStatus={s}
                      onClick={() => navigate(`/admin/bookings/${b.id}`)}
                    />
                  ))}
                </div>

              )}
            </>
          )}
        </SectionCard>
      </div>


      {/* ────────── EM PREPARAÇÃO (compact bottom strip) ────────── */}
      <div className="relative rounded-2xl border border-border/40 bg-gradient-to-r from-sky-500/[0.04] via-card/60 to-card/60 overflow-hidden">
        <GarageBackdrop />
        <div className="relative z-10 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Wrench size={14} />
              </div>
              <div>
                <h2 className="text-xs font-medium uppercase tracking-[0.1em] text-sky-600 dark:text-sky-400">
                  Em preparação
                </h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Veículos sendo higienizados ou em manutenção
                </p>
              </div>
            </div>
            <span className="text-sm font-medium tabular-nums text-sky-600 dark:text-sky-400 shrink-0">
              {maintenance.length}
            </span>
          </div>

          {maintenance.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Frota toda pronta para circular.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
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
    <div className="relative flex min-h-[118px] flex-col items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-card/80 px-3 py-4 text-center">
      <div className="relative z-10 flex flex-col items-center justify-center gap-2">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.14em] font-medium text-muted-foreground leading-[1.15]">
            {label}
          </p>
          <p className={`mt-1 text-xl font-medium tabular-nums leading-[1.05] ${valueColor}`}>
            {value}
          </p>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground mt-1.5 relative z-10 leading-[1.2]">{sub}</p>
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
    <div className={`relative rounded-2xl border border-border/40 bg-card/60 p-4 overflow-hidden flex flex-col min-h-[min(640px,calc(100vh-280px))] ${className}`}>
      {backdrop}
      <div className="flex items-start justify-between gap-2 mb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
          <div>
            <h2 className={`text-xs font-medium uppercase tracking-[0.1em] ${titleColor}`}>
              {title}
            </h2>
            <div className={`mt-1 h-0.5 w-10 rounded-full ${accentColor}`} />
          </div>
        </div>
        <span className={`text-sm font-medium tabular-nums ${countColor}`}>{count}</span>
      </div>
      <div className="flex-1 relative z-10">{children}</div>
    </div>
  );
}

function StatusLegend({
  counts, active, onChange,
}: {
  counts: Record<OpsStatus, number>;
  active: OpsStatus | "all";
  onChange: (s: OpsStatus | "all") => void;
}) {
  const total = counts.completed + counts.late + counts.pending;
  const order: OpsStatus[] = ["completed", "late", "pending"];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => onChange("all")}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
          active === "all"
            ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
            : "border-border/40 bg-card/60 text-muted-foreground hover:text-foreground"
        }`}
      >
        Todas
        <span className="tabular-nums">{total}</span>
      </button>
      {order.map(s => {
        const m = STATUS_META[s];
        const c = counts[s];
        if (c === 0 && active !== s) return null;
        const isActive = active === s;
        return (
          <button
            key={s}
            onClick={() => onChange(isActive ? "all" : s)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
              isActive
                ? `${m.chipBorder} ${m.chipBg} ${m.chipText}`
                : "border-border/40 bg-card/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
            {m.label}
            <span className="tabular-nums">{c}</span>
          </button>
        );
      })}
    </div>
  );
}

function BookingRowCard({
  booking, vehicle, type, opsStatus, onClick,
}: {
  booking: BookingRow; vehicle?: Vehicle; type: "pickup" | "return"; opsStatus: OpsStatus; onClick: () => void;
}) {
  const navigate = useNavigate();
  const time = type === "pickup" ? booking.pickup_time : booking.return_time;
  const loc = type === "pickup" ? booking.pickup_location : booking.return_location;
  const m = STATUS_META[opsStatus];
  const badge = type === "pickup"
    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    : "bg-amber-500/15 text-amber-600 dark:text-amber-400";

  const inspectionType = type === "pickup" ? "checkin" : "checkout";
  const inspectionTone = type === "pickup"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20";

  const brand = vehicle?.name?.split(" ")[0];
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="w-full text-left rounded-xl border border-border/40 bg-background/80 backdrop-blur-sm hover:bg-background hover:border-border/70 hover:shadow-md transition-all group relative overflow-hidden cursor-pointer"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${m.bar}`} />
      <div className="pl-3 pr-2.5 py-2">
        <div className="flex items-center gap-2.5">
          {vehicle && (
            <BrandAvatar brand={brand} name={vehicle.name} size={28} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-base font-medium tabular-nums text-foreground leading-none">
                {time ? time.slice(0, 5) : ""}
              </span>
              <span className="text-[13px] font-semibold text-foreground truncate">
                {formatPersonName(booking.customer_name)}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${m.chipBorder} ${m.chipBg} ${m.chipText}`}>
                <span className={`h-1 w-1 rounded-full ${m.dot}`} />
                {m.label.replace(/s$/, "")}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground min-w-0">
              <span className="inline-flex items-center gap-1 truncate">
                <Car size={10} className="shrink-0" />
                <span className="truncate">{vehicle?.name || ""}</span>
              </span>
              {loc && (
                <span className="inline-flex items-center gap-1 truncate">
                  <MapPin size={10} className="shrink-0" />
                  <span className="truncate">{loc}</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {booking.booking_number && (
              <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md font-semibold ${badge}`}>
                {booking.booking_number}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/admin/inspection/${booking.id}?type=${inspectionType}`);
              }}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${inspectionTone}`}
              title={type === "pickup" ? "Inspeção de entrega" : "Inspeção de devolução"}
            >
              <Play size={9} className="fill-current" />
              Inspeção
            </button>
            <ChevronRight size={14} className="text-muted-foreground/60 group-hover:text-foreground transition-colors" />
          </div>
        </div>
      </div>

    </div>
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
        <h3 className={`text-[11px] font-medium uppercase tracking-[0.14em] ${text}`}>
          {title}
        </h3>
        <span className={`text-[11px] font-medium tabular-nums ${text}`}>
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

/* ─────────────── decorative backdrops (discreet, location-themed) ─────────────── */

/**
 * MIAMI scene (pickups / emerald): Art Deco Ocean Drive skyline with stepped
 * rooftops + neon spires, a row of palms, seagulls and a tiny convertible
 * silhouette. Rendered in a single low-opacity tone.
 */
function SunriseBackdrop() {
  const color = "text-emerald-500/[0.09] dark:text-emerald-400/[0.09]";
  return (
    <svg
      className={`absolute left-0 right-0 bottom-0 w-full ${color} pointer-events-none`}
      viewBox="0 0 600 180" preserveAspectRatio="xMidYMax slice" fill="currentColor" aria-hidden="true"
    >
      {/* seagulls */}
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M250 38 q 4 -4 8 0 q 4 -4 8 0" />
        <path d="M275 50 q 3 -3 6 0 q 3 -3 6 0" />
        <path d="M305 32 q 4 -4 8 0 q 4 -4 8 0" />
      </g>

      {/* Art Deco Ocean Drive skyline. stepped/rounded rooftops, antennas */}
      <g>
        {/* low rounded hotel */}
        <path d="M30 170 L30 130 Q30 122 38 122 L70 122 Q78 122 78 130 L78 170 Z" />
        <rect x="50" y="112" width="8" height="10" />
        {/* stepped deco tower */}
        <path d="M86 170 L86 110 L106 110 L106 100 L116 100 L116 88 L122 88 L122 100 L132 100 L132 110 L152 110 L152 170 Z" />
        <rect x="118" y="76" width="2" height="14" />
        {/* curved corner hotel (typical Miami) */}
        <path d="M160 170 L160 118 Q160 104 174 104 L196 104 Q210 104 210 118 L210 170 Z" />
        <rect x="180" y="94" width="10" height="10" />
        {/* slim deco spire */}
        <path d="M218 170 L218 100 L232 100 L232 84 L238 84 L238 70 L242 70 L242 84 L248 84 L248 100 L262 100 L262 170 Z" />
        {/* low stepped pyramid block */}
        <path d="M270 170 L270 128 L284 128 L284 118 L300 118 L300 128 L314 128 L314 170 Z" />
      </g>

      {/* palms along the avenue */}
      <g>
        <rect x="335" y="80" width="3" height="90" />
        <path d="M336.5 80 q -22 -8 -34 -1 q 20 -2 32 7 z" />
        <path d="M336.5 80 q 22 -8 34 -1 q -20 -2 -32 7 z" />
        <path d="M336.5 80 q -6 -20 -2 -32 q 7 16 7 32 z" />
        <path d="M336.5 80 q 6 -20 2 -32 q -7 16 -7 32 z" />

        <rect x="395" y="100" width="3" height="70" />
        <path d="M396.5 100 q -18 -6 -28 -1 q 16 -2 26 6 z" />
        <path d="M396.5 100 q 18 -6 28 -1 q -16 -2 -26 6 z" />
        <path d="M396.5 100 q -5 -16 -1 -26 q 6 12 6 26 z" />

        <rect x="450" y="115" width="3" height="55" />
        <path d="M451.5 115 q -14 -5 -22 -1 q 12 -1 20 5 z" />
        <path d="M451.5 115 q 14 -5 22 -1 q -12 -1 -20 5 z" />
        <path d="M451.5 115 q -4 -12 -1 -20 q 5 10 5 20 z" />

        <rect x="540" y="105" width="3" height="65" />
        <path d="M541.5 105 q -16 -6 -26 -1 q 14 -2 24 6 z" />
        <path d="M541.5 105 q 16 -6 26 -1 q -14 -2 -24 6 z" />
        <path d="M541.5 105 q -5 -14 -1 -24 q 5 11 5 24 z" />
      </g>

      {/* tiny convertible silhouette cruising the strip */}
      <g>
        <path d="M468 160 q 2 -6 8 -6 l 10 0 l 6 -6 q 2 -2 6 -2 l 18 0 q 4 0 6 2 l 6 6 l 8 0 q 4 0 4 4 l 0 2 l -72 0 l 0 -2 q 0 -2 0 -2 z" />
        <circle cx="482" cy="164" r="3.5" />
        <circle cx="522" cy="164" r="3.5" />
      </g>
    </svg>
  );
}

/**
 * ORLANDO scene (returns / amber): theme-park castle with three spires,
 * a small ferris wheel, palms and a tram silhouette — all rendered as a
 * discreet low-opacity silhouette.
 */
function SunsetBackdrop() {
  const color = "text-amber-500/[0.09] dark:text-amber-400/[0.09]";
  return (
    <svg
      className={`absolute left-0 right-0 bottom-0 w-full ${color} pointer-events-none`}
      viewBox="0 0 600 180" preserveAspectRatio="xMidYMax slice" fill="currentColor" aria-hidden="true"
    >
      {/* tiny fireworks sparks */}
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M180 28 l 0 -6 M180 40 l 0 6 M174 34 l -6 0 M186 34 l 6 0 M176 30 l -4 -4 M184 30 l 4 -4 M176 38 l -4 4 M184 38 l 4 4" />
        <path d="M310 22 l 0 -5 M310 32 l 0 5 M305 27 l -5 0 M315 27 l 5 0" />
      </g>

      {/* ferris wheel (small, to the left) */}
      <g fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="70" cy="120" r="32" />
        <line x1="70" y1="88" x2="70" y2="152" />
        <line x1="38" y1="120" x2="102" y2="120" />
        <line x1="48" y1="98" x2="92" y2="142" />
        <line x1="92" y1="98" x2="48" y2="142" />
      </g>
      <g fill="currentColor">
        <circle cx="70" cy="88" r="2.5" />
        <circle cx="102" cy="120" r="2.5" />
        <circle cx="70" cy="152" r="2.5" />
        <circle cx="38" cy="120" r="2.5" />
        <circle cx="92" cy="98" r="2.5" />
        <circle cx="92" cy="142" r="2.5" />
        <circle cx="48" cy="98" r="2.5" />
        <circle cx="48" cy="142" r="2.5" />
        {/* wheel base */}
        <path d="M50 170 L70 130 L90 170 Z" />
      </g>

      {/* fairy-tale castle in the center */}
      <g>
        {/* main keep */}
        <rect x="200" y="110" width="60" height="60" />
        {/* battlements */}
        <rect x="200" y="106" width="8" height="4" />
        <rect x="216" y="106" width="8" height="4" />
        <rect x="232" y="106" width="8" height="4" />
        <rect x="248" y="106" width="8" height="4" />
        {/* gate arch */}
        <path d="M222 170 L222 148 Q222 138 230 138 Q238 138 238 148 L238 170 Z" fill="hsl(var(--background))" />
        {/* left tower */}
        <rect x="186" y="92" width="14" height="78" />
        <path d="M186 92 L193 72 L200 92 Z" />
        <rect x="192" y="64" width="2" height="10" />
        {/* right tower */}
        <rect x="260" y="92" width="14" height="78" />
        <path d="M260 92 L267 72 L274 92 Z" />
        <rect x="266" y="64" width="2" height="10" />
        {/* central tall spire */}
        <rect x="224" y="78" width="12" height="32" />
        <path d="M224 78 L230 52 L236 78 Z" />
        <rect x="229" y="42" width="2" height="12" />
        <path d="M231 44 l 6 -3 l -6 -3 z" />
        {/* small flanking spires */}
        <rect x="208" y="96" width="6" height="14" />
        <path d="M208 96 L211 86 L214 96 Z" />
        <rect x="246" y="96" width="6" height="14" />
        <path d="M246 96 L249 86 L252 96 Z" />
      </g>

      {/* palms on the right */}
      <g>
        <rect x="395" y="100" width="3" height="70" />
        <path d="M396.5 100 q -18 -6 -28 -1 q 16 -2 26 6 z" />
        <path d="M396.5 100 q 18 -6 28 -1 q -16 -2 -26 6 z" />
        <path d="M396.5 100 q -5 -16 -1 -26 q 6 12 6 26 z" />

        <rect x="450" y="115" width="3" height="55" />
        <path d="M451.5 115 q -14 -5 -22 -1 q 12 -1 20 5 z" />
        <path d="M451.5 115 q 14 -5 22 -1 q -12 -1 -20 5 z" />
        <path d="M451.5 115 q -4 -12 -1 -20 q 5 10 5 20 z" />

        <rect x="540" y="105" width="3" height="65" />
        <path d="M541.5 105 q -16 -6 -26 -1 q 14 -2 24 6 z" />
        <path d="M541.5 105 q 16 -6 26 -1 q -14 -2 -24 6 z" />
        <path d="M541.5 105 q -5 -14 -1 -24 q 5 11 5 24 z" />
      </g>

      {/* park tram silhouette */}
      <g>
        <rect x="475" y="152" width="22" height="10" rx="2" />
        <rect x="500" y="150" width="22" height="12" rx="2" />
        <rect x="525" y="152" width="22" height="10" rx="2" />
        <circle cx="482" cy="164" r="2.5" />
        <circle cx="494" cy="164" r="2.5" />
        <circle cx="508" cy="164" r="2.5" />
        <circle cx="520" cy="164" r="2.5" />
        <circle cx="532" cy="164" r="2.5" />
        <circle cx="544" cy="164" r="2.5" />
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

