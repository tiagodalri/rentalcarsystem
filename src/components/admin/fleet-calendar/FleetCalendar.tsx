import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { LoadingRows } from "@/components/skeletons/LoadingRows";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Search,
  Filter, X, Wrench, CarFront, Activity, Truck, Lock,
} from "lucide-react";
import {
  addDays, format, parseISO, startOfDay, differenceInCalendarDays, isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { BrandAvatar } from "./BrandAvatar";
import { BookingBar, BookingLike, STATUS_TOKEN } from "./BookingBar";
import { InformalBookingDialog } from "./InformalBookingDialog";

type Vehicle = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  status: string;
  license_plate: string | null;
};

const SCALES = [
  { value: 7, label: "7d", dayWidth: 96 },
  { value: 14, label: "14d", dayWidth: 56 },
  { value: 30, label: "30d", dayWidth: 36 },
  { value: 60, label: "60d", dayWidth: 22 },
];

const VEHICLE_COL = 240;
const ROW_HEIGHT = 56;

const VEHICLE_STATUS_LABEL: Record<string, string> = {
  available: "Disponível",
  rented: "Alugado",
  maintenance: "Em manutenção",
  reserved: "Reservado",
  inactive: "Inativo",
};

export function FleetCalendar() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<BookingLike[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [scaleIdx, setScaleIdx] = useState(2); // 30d default
  const scale = SCALES[scaleIdx];
  const DAYS_WINDOW = scale.value;
  const DAY_WIDTH = scale.dayWidth;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [showCancelled, setShowCancelled] = useState(false);
  const [informalOpen, setInformalOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);


  useEffect(() => {
    (async () => {
      setLoading(true);
      const endDate = addDays(startDate, DAYS_WINDOW + 7);
      const bookingQuery = supabase
        .from("bookings")
        .select("id, vehicle_id, customer_name, customer_phone, customer_email, pickup_date, return_date, pickup_time, return_time, pickup_location, return_location, status, booking_number, total_price")
        .lte("pickup_date", format(endDate, "yyyy-MM-dd"))
        .gte("return_date", format(addDays(startDate, -7), "yyyy-MM-dd"));

      const [v, b] = await Promise.all([
        supabase.from("vehicles")
          .select("id, name, brand, model, category, status, license_plate")
          .neq("status", "sold")
          .order("name"),
        showCancelled ? bookingQuery : bookingQuery.neq("status", "cancelled"),
      ]);
      setVehicles((v.data as Vehicle[]) || []);
      setBookings((b.data as BookingLike[]) || []);
      setLoading(false);
    })();
  }, [startDate, DAYS_WINDOW, showCancelled, reloadTick]);

  const days = useMemo(
    () => Array.from({ length: DAYS_WINDOW }, (_, i) => addDays(startDate, i)),
    [startDate, DAYS_WINDOW]
  );
  const today = startOfDay(new Date());

  // Filters
  const categories = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach(v => v.category && set.add(v.category));
    return Array.from(set).sort();
  }, [vehicles]);
  const brands = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach(v => v.brand && set.add(v.brand));
    return Array.from(set).sort();
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter(v => {
      if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
      if (brandFilter !== "all" && v.brand !== brandFilter) return false;
      if (!q) return true;
      const vehMatches =
        v.name?.toLowerCase().includes(q) ||
        v.license_plate?.toLowerCase().includes(q) ||
        v.brand?.toLowerCase().includes(q) ||
        v.model?.toLowerCase().includes(q);
      if (vehMatches) return true;
      // Also match if any booking on this vehicle matches search
      return bookings.some(b =>
        b.vehicle_id === v.id &&
        (b.customer_name?.toLowerCase().includes(q) ||
          b.booking_number?.toLowerCase().includes(q))
      );
    });
  }, [vehicles, bookings, search, categoryFilter, brandFilter]);

  const filteredBookings = useMemo(() => {
    if (statusFilter === "all") return bookings;
    return bookings.filter(b => b.status === statusFilter);
  }, [bookings, statusFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const activeVehicles = vehicles.filter(v => v.status !== "inactive" && v.status !== "sold").length;
    const bookingsInWindow = bookings.length;
    const endWindow = addDays(startDate, DAYS_WINDOW - 1);
    let rentedDays = 0;
    bookings.forEach(b => {
      if (b.status === "cancelled") return;
      const s = parseISO(b.pickup_date);
      const e = parseISO(b.return_date);
      const clipStart = s < startDate ? startDate : s;
      const clipEnd = e > endWindow ? endWindow : e;
      const d = differenceInCalendarDays(clipEnd, clipStart) + 1;
      if (d > 0) rentedDays += d;
    });
    const occupancy = activeVehicles > 0
      ? Math.round((rentedDays / (activeVehicles * DAYS_WINDOW)) * 100)
      : 0;
    const pickupsToday = bookings.filter(b => isSameDay(parseISO(b.pickup_date), today)).length;
    const returnsToday = bookings.filter(b => isSameDay(parseISO(b.return_date), today)).length;
    return { activeVehicles, bookingsInWindow, occupancy, pickupsToday, returnsToday };
  }, [vehicles, bookings, startDate, DAYS_WINDOW, today]);

  const getBookingPosition = (b: BookingLike) => {
    const pickup = startOfDay(parseISO(b.pickup_date));
    const ret = startOfDay(parseISO(b.return_date));
    const offset = differenceInCalendarDays(pickup, startDate);
    const length = differenceInCalendarDays(ret, pickup) + 1;
    const clippedStart = Math.max(0, offset);
    const clippedEnd = Math.min(DAYS_WINDOW, offset + length);
    if (clippedEnd <= 0 || clippedStart >= DAYS_WINDOW) return null;
    return {
      left: clippedStart * DAY_WIDTH,
      width: (clippedEnd - clippedStart) * DAY_WIDTH - 4,
    };
  };

  const rangeLabel =
    `${format(startDate, "dd MMM", { locale: ptBR })}. ${format(addDays(startDate, DAYS_WINDOW - 1), "dd MMM yyyy", { locale: ptBR })}`;

  const clearFilters = () => {
    setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); setBrandFilter("all");
  };
  const hasFilters = search || statusFilter !== "all" || categoryFilter !== "all" || brandFilter !== "all";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="admin-h1 text-2xl">Agenda da Frota</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão de ocupação por veículo • <span className="tabular-nums">{rangeLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default" size="sm"
            onClick={() => setInformalOpen(true)}
            className="h-9 gap-1.5 text-xs uppercase tracking-wider font-semibold"
          >
            <Lock size={12} /> Bloquear data
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => setStartDate(addDays(startDate, -Math.ceil(DAYS_WINDOW / 2)))}
            className="h-9 w-9 p-0"
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => setStartDate(startOfDay(new Date()))}
            className="h-9 gap-1 text-xs uppercase tracking-wider font-semibold"
          >
            <CalendarIcon size={12} /> Hoje
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => setStartDate(addDays(startDate, Math.ceil(DAYS_WINDOW / 2)))}
            className="h-9 w-9 p-0"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<CarFront size={14} />} label="Veículos ativos" value={kpis.activeVehicles} />
        <Kpi icon={<Activity size={14} />} label="Ocupação do período" value={`${kpis.occupancy}%`} tone="primary" />
        <Kpi icon={<Truck size={14} />} label="Retiradas hoje" value={kpis.pickupsToday} />
        <Kpi icon={<Wrench size={14} />} label="Devoluções hoje" value={kpis.returnsToday} />
      </div>

      {/* Filters */}
      <Card className="p-3 bg-card/60 border-border/40">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, placa, nº reserva…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_TOKEN).map(([k, t]) => (
                <SelectItem key={k} value={k}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {brands.length > 0 && (
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue placeholder="Marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as marcas</SelectItem>
                {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center rounded-md border border-border/50 bg-background overflow-hidden">
            {SCALES.map((s, i) => (
              <button
                key={s.value}
                onClick={() => setScaleIdx(i)}
                className={`h-9 px-2.5 text-[11px] font-semibold tabular-nums transition-colors ${
                  i === scaleIdx
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCancelled(!showCancelled)}
            className={`h-9 px-2.5 text-[11px] font-semibold rounded-md border transition-colors ${
              showCancelled
                ? "bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400"
                : "border-border/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            Canceladas
          </button>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
              <X size={12} /> Limpar
            </Button>
          )}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border/30">
          {(["pending","confirmed","in_progress","completed","cancelled"] as const).map(k => {
            const t = STATUS_TOKEN[k];
            const active = statusFilter === k;
            return (
              <button
                key={k}
                onClick={() => setStatusFilter(active ? "all" : k)}
                className={`flex items-center gap-1.5 text-[11px] transition-opacity ${active ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${t.dot}`} />
                <span className={active ? "font-semibold text-foreground" : "text-muted-foreground"}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Timeline */}
      <Card className="bg-card/60 border-border/30 overflow-hidden">
        {loading ? (
          <LoadingRows count={6} rowHeight={56} className="p-4" />
        ) : filteredVehicles.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground space-y-2">
            <Filter size={20} className="mx-auto text-muted-foreground/60" />
            <div>Nenhum veículo encontrado com os filtros atuais.</div>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header. days */}
              <div className="flex border-b border-border/40 bg-muted/30 sticky top-0 z-20">
                <div
                  className="shrink-0 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/40 flex items-center"
                  style={{ width: VEHICLE_COL }}
                >
                  Veículo
                </div>
                <div className="flex">
                  {days.map((d, i) => {
                    const isToday = d.getTime() === today.getTime();
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={i}
                        style={{ width: DAY_WIDTH }}
                        className={`shrink-0 border-r border-border/20 px-1 py-1.5 text-center ${
                          isToday ? "bg-primary/15" : isWeekend ? "bg-muted/40" : ""
                        }`}
                      >
                        <div className={`text-[9px] uppercase ${isToday ? "text-primary font-medium" : "text-muted-foreground"}`}>
                          {format(d, "EEE", { locale: ptBR }).slice(0, 3)}
                        </div>
                        <div className={`text-[11px] tabular-nums ${isToday ? "text-primary font-medium" : "text-foreground"}`}>
                          {format(d, "dd")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows */}
              {filteredVehicles.map((v) => {
                const vBookings = filteredBookings.filter(b => b.vehicle_id === v.id);
                return (
                  <div
                    key={v.id}
                    className="flex border-b border-border/15 hover:bg-muted/20 transition-colors group"
                  >
                    <button
                      onClick={() => navigate(`/admin/fleet/${v.id}`)}
                      style={{ height: ROW_HEIGHT, width: VEHICLE_COL }}
                      className="shrink-0 px-3 flex items-center gap-2.5 border-r border-border/40 text-left hover:bg-muted/40 transition-colors"
                    >
                      <BrandAvatar brand={v.brand} name={v.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground truncate">
                          {v.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {v.license_plate && (
                            <span className="text-[10px] font-mono tabular-nums text-muted-foreground bg-muted/60 px-1 rounded">
                              {v.license_plate}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground truncate">
                            {v.category || v.model}
                          </span>
                        </div>
                      </div>
                      <span
                        title={VEHICLE_STATUS_LABEL[v.status] || v.status}
                        className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                          v.status === "maintenance"
                            ? "bg-amber-500"
                            : v.status === "rented"
                              ? "bg-emerald-500"
                              : v.status === "inactive"
                                ? "bg-zinc-400"
                                : "bg-sky-500"
                        }`}
                      />
                    </button>
                    <div className="relative flex" style={{ height: ROW_HEIGHT }}>
                      {days.map((d, i) => {
                        const isToday = d.getTime() === today.getTime();
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div
                            key={i}
                            style={{ width: DAY_WIDTH }}
                            className={`shrink-0 border-r border-border/10 ${
                              isToday ? "bg-primary/10" : isWeekend ? "bg-muted/20" : ""
                            }`}
                          />
                        );
                      })}
                      {v.status === "maintenance" && (
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(45deg, hsl(var(--destructive) / 0.08) 0 6px, transparent 6px 12px)",
                          }}
                        />
                      )}
                      {vBookings.map(b => {
                        const pos = getBookingPosition(b);
                        if (!pos) return null;
                        return (
                          <BookingBar
                            key={b.id}
                            booking={b}
                            left={pos.left}
                            width={pos.width}
                            height={ROW_HEIGHT - 8}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <InformalBookingDialog
        open={informalOpen}
        onOpenChange={setInformalOpen}
        onCreated={() => setReloadTick(t => t + 1)}
        vehicles={vehicles.map(v => ({ id: v.id, name: v.name, license_plate: v.license_plate }))}
        defaultStartDate={format(startDate, "yyyy-MM-dd")}
      />
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: "primary" }) {
  return (
    <Card className={`p-3 border-border/40 ${tone === "primary" ? "bg-primary/5 border-primary/30" : "bg-card/60"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {icon} {label}
      </div>
      <div className="mt-1 admin-kpi text-2xl">{value}</div>
    </Card>
  );
}
