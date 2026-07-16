import { useEffect, useState, useMemo, useCallback } from "react";
import { parseDateOnly } from "@/lib/dateOnly";
import { useIsMobileApp } from "@/hooks/useIsMobileApp";
import MobileBookings from "./mobile/MobileBookings";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Trash2, LogIn, LogOut, GitCompare, CalendarDays, List, ChevronLeft, ChevronRight, Clock, SlidersHorizontal, ArrowUpDown, X, Check, Download, FileText, FileSpreadsheet, CalendarIcon, Plus, Car, Plane, MapPin } from "lucide-react";

import { EmptyState } from "@/components/admin/EmptyState";
import { MobileBookingCard } from "@/components/admin/MobileBookingCard";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { toast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRegisterFab } from "@/hooks/useAdminFab";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
// jsPDF é pesado (~600KB gzip). Importado dinâmico só quando o usuário clica em "Exportar PDF".
import type jsPDFType from "jspdf";
import { storageThumb } from "@/lib/storageThumb";
import { coverImageMap } from "@/data/fleetAssets";
import { deleteBookingSafe } from "@/lib/deleteBookingSafe";
import { useHideFinancials } from "@/hooks/useHideFinancials";


type Booking = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  pickup_date: string;
  return_date: string;
  pickup_time: string | null;
  return_time: string | null;
  pickup_location: string | null;
  return_location: string | null;
  total_price: number | null;
  deposit_amount: number | null;
  deposit_refund_days: number | null;
  franchise_amount: number | null;
  status: string;
  notes: string | null;
  driver_age: number | null;
  extra_driver: boolean | null;
  vehicle_id: string | null;
  created_at: string;
  addons: Record<string, any> | null;
  booking_number?: string | null;
  vehicle_name?: string;
  vehicle_image?: string;
};


const statusConfig: Record<string, { label: string; color: string; calBg: string; calText: string; accent: string }> = {
  pending:     { label: "Pendente",       color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", calBg: "bg-yellow-500/15", calText: "text-yellow-700 dark:text-yellow-400", accent: "border-l-yellow-500" },
  confirmed:   { label: "Confirmada",     color: "bg-blue-500/10 text-blue-500 border-blue-500/20",       calBg: "bg-blue-500/15",   calText: "text-blue-700 dark:text-blue-400",     accent: "border-l-blue-500" },
  active:      { label: "Ativa",          color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", calBg: "bg-emerald-500/15", calText: "text-emerald-700 dark:text-emerald-400", accent: "border-l-emerald-500" },
  in_progress: { label: "Em andamento",   color: "bg-amber-500/10 text-amber-600 border-amber-500/20",    calBg: "bg-amber-500/15",  calText: "text-amber-700 dark:text-amber-400",   accent: "border-l-amber-500" },
  completed:   { label: "Concluída",      color: "bg-muted text-muted-foreground border-border/30",       calBg: "bg-muted",          calText: "text-muted-foreground",                accent: "border-l-muted-foreground/40" },
  cancelled:   { label: "Cancelada",      color: "bg-red-500/10 text-red-500 border-red-500/20",          calBg: "bg-red-500/10",     calText: "text-red-600 dark:text-red-400",       accent: "border-l-red-500" },
};

function getBookingProgress(pickupDate: string, returnDate: string, status: string): number {
  if (status === "completed") return 100;
  if (status === "pending" || status === "confirmed" || status === "cancelled") return 0;
  const now = new Date().getTime();
  const start = new Date(pickupDate).getTime();
  const end = new Date(returnDate).getTime();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// ─── Monthly Calendar ───────────────────────────────────────
function CalendarView({ bookings, navigate }: { bookings: Booking[]; navigate: (path: string) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const hideFin = useHideFinancials();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const bookingsByDay = useMemo(() => {
    const map: Record<number, Booking[]> = {};
    bookings.forEach((b) => {
      const pickup = parseDateOnly(b.pickup_date);
      const ret = parseDateOnly(b.return_date);
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        if (date >= new Date(pickup.getFullYear(), pickup.getMonth(), pickup.getDate()) &&
            date <= new Date(ret.getFullYear(), ret.getMonth(), ret.getDate())) {
          if (!map[d]) map[d] = [];
          map[d].push(b);
        }
      }
    });
    return map;
  }, [bookings, year, month, daysInMonth]);

  const today = new Date();
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-sm font-medium text-foreground min-w-[180px] text-center capitalize tracking-tight">
            {new Date(year, month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </h2>
          <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronRight size={16} />
          </button>
        </div>
        <button onClick={goToday} className="text-xs px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium">
          Hoje
        </button>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhuma reserva registrada"
          description="As reservas aparecerão aqui assim que forem criadas pelo site ou manualmente."
        />
      ) : (
      <>
      <Card className="border-border/30 overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b border-border/30 bg-muted/20">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="px-2 py-2.5 text-center text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const dayBookings = day ? (bookingsByDay[day] || []) : [];
              const showMax = 2;

              return (
                <div
                  key={i}
                  className={`min-h-[110px] border-b border-r border-border/15 p-1.5 transition-colors ${
                    day ? "bg-card/50 hover:bg-muted/30" : "bg-muted/10"
                  }`}
                >
                  {day && (
                    <>
                      <div className={`text-xs font-medium mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday(day) ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}>
                        {day}
                      </div>
                      <div className="space-y-1">
                        {dayBookings.slice(0, showMax).map((b) => {
                          const sc = statusConfig[b.status] || statusConfig.pending;
                          const isPickup = parseDateOnly(b.pickup_date).getDate() === day && parseDateOnly(b.pickup_date).getMonth() === month;
                          const isReturn = parseDateOnly(b.return_date).getDate() === day && parseDateOnly(b.return_date).getMonth() === month;
                          const vehicleShort = b.vehicle_name ? b.vehicle_name.split(" ").slice(0, 2).join(" ") : "";
                          const customerFirst = formatName(b.customer_name).split(" ")[0];
                          const time = isPickup ? b.pickup_time : isReturn ? b.return_time : null;
                          return (
                            <div
                              key={b.id}
                              onClick={() => navigate(`/admin/bookings/${b.id}`)}
                              className={`text-[9px] leading-tight px-1.5 py-1 rounded-md cursor-pointer transition-all hover:scale-[1.02] hover:shadow-sm border ${sc.calBg} ${sc.calText} border-transparent hover:border-current/20`}
                              title={`${b.vehicle_name || ""} • ${b.customer_name}. ${sc.label}${isPickup ? ` (Retirada ${b.pickup_time || ""})` : ""}${isReturn ? ` (Devolução ${b.return_time || ""})` : ""}`}
                            >
                              <div className="font-medium truncate">
                                {isPickup && <span className="opacity-60">→ </span>}
                                {isReturn && <span className="opacity-60">← </span>}
                                {vehicleShort || ""}
                              </div>
                              <div className="opacity-70 truncate flex items-center gap-0.5">
                                {customerFirst}
                                {time && <span className="ml-auto opacity-60">{time}</span>}
                              </div>
                            </div>
                          );
                        })}
                        {dayBookings.length > showMax && (
                          <div className="text-[9px] text-muted-foreground font-medium px-1.5 cursor-default">
                            +{dayBookings.length - showMax} mais
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <CalendarLegend />
      </>
      )}
    </div>
  );
}

// ─── Weekly Calendar ───────────────────────────────────────
function WeeklyView({ bookings, navigate }: { bookings: Booking[]; navigate: (path: string) => void }) {
  const hideFin = useHideFinancials();
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // start on Sunday
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const goToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    setWeekStart(d);
  };

  const bookingsByDay = useMemo(() => {
    const map: Record<string, { booking: Booking; isPickup: boolean; isReturn: boolean; isMid: boolean }[]> = {};
    weekDays.forEach((day) => {
      const key = day.toISOString().slice(0, 10);
      map[key] = [];
    });

    bookings.forEach((b) => {
      const pickup = new Date(b.pickup_date + "T00:00:00");
      const ret = new Date(b.return_date + "T00:00:00");

      weekDays.forEach((day) => {
        const dayMs = day.getTime();
        const pickupMs = new Date(pickup.getFullYear(), pickup.getMonth(), pickup.getDate()).getTime();
        const retMs = new Date(ret.getFullYear(), ret.getMonth(), ret.getDate()).getTime();

        if (dayMs >= pickupMs && dayMs <= retMs) {
          const key = day.toISOString().slice(0, 10);
          map[key].push({
            booking: b,
            isPickup: dayMs === pickupMs,
            isReturn: dayMs === retMs,
            isMid: dayMs > pickupMs && dayMs < retMs,
          });
        }
      });
    });
    return map;
  }, [bookings, weekDays]);

  const today = new Date();
  const todayStr = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 10);

  const weekEnd = weekDays[6];
  const rangeLabel = `${weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}. ${weekEnd.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-sm font-medium text-foreground min-w-[220px] text-center tracking-tight">
            {rangeLabel}
          </h2>
          <button onClick={nextWeek} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronRight size={16} />
          </button>
        </div>
        <button onClick={goToday} className="text-xs px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium">
          Hoje
        </button>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhuma reserva registrada"
          description="As reservas aparecerão aqui assim que forem criadas pelo site ou manualmente."
        />
      ) : (
      <>
      <div className="grid grid-cols-7 gap-3">
        {weekDays.map((day, i) => {
          const key = day.toISOString().slice(0, 10);
          const isToday = key === todayStr;
          const entries = bookingsByDay[key] || [];

          return (
            <div key={key} className="space-y-2">
              {/* Day header */}
              <div className={`text-center rounded-lg py-2 ${isToday ? "bg-primary text-primary-foreground" : "bg-muted/30"}`}>
                <div className="text-[10px] uppercase tracking-wider font-semibold opacity-70">
                  {WEEKDAYS_FULL[i]}
                </div>
                <div className={`text-lg font-medium ${isToday ? "" : "text-foreground"}`}>
                  {day.getDate()}
                </div>
                <div className="text-[10px] opacity-60">
                  {day.toLocaleDateString("pt-BR", { month: "short" })}
                </div>
              </div>

              {/* Bookings for this day */}
              <div className="space-y-2 min-h-[200px]">
                {entries.length === 0 && (
                  <div className="text-[10px] text-muted-foreground/40 text-center py-4"></div>
                )}
                {entries.map(({ booking: b, isPickup, isReturn, isMid }) => {
                  const sc = statusConfig[b.status] || statusConfig.pending;
                  const vehicleShort = b.vehicle_name ? b.vehicle_name.split(" ").slice(0, 2).join(" ") : "";
                  const customerFirst = formatName(b.customer_name).split(" ")[0];

                  const isMovement = isPickup || isReturn;
                  const movementBg = isPickup
                    ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30"
                    : isReturn
                      ? "bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/30"
                      : "";

                  return (
                    <div
                      key={b.id}
                      onClick={() => navigate(`/admin/bookings/${b.id}`)}
                      className={`rounded-lg p-2.5 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] border-l-[3px] ${isMovement ? (isPickup ? "border-l-emerald-500" : "border-l-orange-500") : sc.accent} ${isMovement ? movementBg : sc.calBg} ${sc.calText}`}
                    >
                      {/* Movement badge */}
                      {(isPickup || isReturn) && (
                        <div className="flex items-center gap-1 mb-1.5">
                          {isPickup && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                              → Retirada
                            </span>
                          )}
                          {isReturn && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider bg-orange-500/20 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded">
                              ← Devolução
                            </span>
                          )}
                        </div>
                      )}
                      {isMid && (
                        <div className="text-[9px] font-medium uppercase tracking-wider opacity-50 mb-1">
                          Em uso
                        </div>
                      )}

                      {/* Vehicle */}
                      <div className="font-medium text-[11px] truncate">{vehicleShort}</div>

                      {/* Customer */}
                      <div className="text-[10px] opacity-70 truncate">{customerFirst}</div>

                      {/* Time */}
                      {(isPickup || isReturn) && (
                        <div className="flex items-center gap-1 mt-1.5 text-[9px] opacity-60">
                          <Clock size={9} />
                          <span>{isPickup ? (b.pickup_time || "") : (b.return_time || "")}</span>
                        </div>
                      )}

                      {/* Location */}
                      {isPickup && b.pickup_location && (
                        <div className="text-[9px] opacity-50 truncate mt-0.5">📍 {b.pickup_location}</div>
                      )}
                      {isReturn && b.return_location && (
                        <div className="text-[9px] opacity-50 truncate mt-0.5">📍 {b.return_location}</div>
                      )}

                      {/* Price (hidden for restricted operators) */}
                      {!hideFin && b.total_price && (
                        <div className="text-[9px] font-semibold mt-1.5 opacity-80 tabular-nums">
                          ${b.total_price.toFixed(2)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <CalendarLegend />
      </>
      )}
    </div>
  );
}

// ─── Shared Legend ──────────────────────────────────────────
function CalendarLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[10px]">
      {Object.entries(statusConfig).map(([key, val]) => (
        <div key={key} className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-sm ${val.calBg}`} />
          <span className="text-muted-foreground">{val.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 ml-2 text-muted-foreground">
        <span>→ Retirada</span> <span>← Devolução</span>
      </div>
    </div>
  );
}

// Format full names: capitalize each word, lowercase particles (da, de, do, das, dos, e)
import { formatPersonName } from "@/lib/formatName";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
const formatName = (raw: string | null | undefined): string => formatPersonName(raw) || "";


// ─── Filter types ───────────────────────────────────────────
type SortField = "created_at" | "pickup_date" | "return_date" | "total_price" | "customer_name";
type SortDir = "asc" | "desc";

type Filters = {
  status: string;
  pickupLocation: string;
  returnLocation: string;
  vehicle: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  sortBy: SortField;
  sortDir: SortDir;
};

const defaultFilters: Filters = {
  status: "all",
  pickupLocation: "all",
  returnLocation: "all",
  vehicle: "all",
  dateFrom: undefined,
  dateTo: undefined,
  sortBy: "created_at",
  sortDir: "desc",
};

const sortLabels: Record<SortField, string> = {
  created_at: "Data de criação",
  pickup_date: "Data de retirada",
  return_date: "Data de devolução",
  total_price: "Valor",
  customer_name: "Nome do cliente",
};

// ─── Preset ranges ──────────────────────────────────────────
type PresetKey = "today" | "week" | "month" | "30d" | "custom";

const PRESET_LABELS: Record<PresetKey, string> = {
  today: "Hoje",
  week: "Esta semana",
  month: "Este mês",
  "30d": "Próximos 30 dias",
  custom: "Personalizado",
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

function getPresetRange(key: PresetKey): { from?: Date; to?: Date } {
  const now = new Date();
  if (key === "today") return { from: startOfDay(now), to: endOfDay(now) };
  if (key === "week") {
    const day = now.getDay(); // 0=Sun
    const diffToMon = (day + 6) % 7;
    const mon = new Date(now); mon.setDate(now.getDate() - diffToMon);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: startOfDay(mon), to: endOfDay(sun) };
  }
  if (key === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: startOfDay(first), to: endOfDay(last) };
  }
  if (key === "30d") {
    const to = new Date(now); to.setDate(now.getDate() + 30);
    return { from: startOfDay(now), to: endOfDay(to) };
  }
  return {};
}

// ─── Main Component ─────────────────────────────────────────
export default function AdminBookings() {
  const navigate = useNavigate();
  const { isMobile } = useIsMobileApp();
  useRegisterFab({ icon: Plus, label: "Nova reserva", onClick: () => navigate("/admin/bookings/new") });
  if (isMobile) return <MobileBookings />;
  return <AdminBookingsDesktop />;
}

function AdminBookingsDesktop() {
  const navigate = useNavigate();
  const hideFin = useHideFinancials();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tollTotals, setTollTotals] = useState<Record<string, number>>({});
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("epass_tolls").select("booking_id,amount").not("booking_id", "is", null);
      const m: Record<string, number> = {};
      (data || []).forEach((r: any) => { if (r.booking_id) m[r.booking_id] = (m[r.booking_id] || 0) + Number(r.amount || 0); });
      setTollTotals(m);
    })();
  }, []);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "calendar" | "week">("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = Number(sessionStorage.getItem("admin-bookings-page-size"));
    return saved && [25, 50, 100, 200].includes(saved) ? saved : 50;
  });
  
  const [searchParams, setSearchParams] = useSearchParams();

  // Load filters from URL on mount
  useEffect(() => {
    const status = searchParams.get("status");
    const range = searchParams.get("range") as PresetKey | null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (status || range || from || to) {
      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;
      if (range && range !== "custom") {
        const r = getPresetRange(range);
        dateFrom = r.from; dateTo = r.to;
      }
      if (from) dateFrom = new Date(from);
      if (to) dateTo = new Date(to);
      setFilters((f) => ({ ...f, status: status || "all", dateFrom, dateTo }));
      if (range) setActivePreset(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist filters to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.status !== "all") params.status = filters.status;
    if (activePreset) params.range = activePreset;
    if (filters.dateFrom) params.from = filters.dateFrom.toISOString();
    if (filters.dateTo) params.to = filters.dateTo.toISOString();
    setSearchParams(params, { replace: true });
  }, [filters.status, filters.dateFrom, filters.dateTo, activePreset, setSearchParams]);

  const applyPreset = (key: PresetKey) => {
    if (key === "custom") {
      setActivePreset("custom");
      return;
    }
    const { from, to } = getPresetRange(key);
    setActivePreset(key);
    setFilters((f) => ({ ...f, dateFrom: from, dateTo: to }));
  };

  const clearAllFilters = () => {
    setFilters(defaultFilters);
    setSearch("");
    setActivePreset(null);
  };

  const load = async () => {
    setLoading(true);
    const [bRes, vRes] = await Promise.all([
      supabase.from("bookings").select("id, booking_number, customer_name, customer_email, customer_phone, status, pickup_date, return_date, pickup_time, return_time, pickup_location, return_location, total_price, deposit_amount, deposit_refund_days, franchise_amount, vehicle_id, plan_id, addons, notes, created_at, customer_id").is("deleted_at", null).order("created_at", { ascending: false }).limit(1000),
      supabase.from("vehicles").select("id, name, image_url, photos").is("deleted_at", null),
    ]);
    const vehicleMap: Record<string, { name: string; image: string }> = {};
    (vRes.data || []).forEach((v: any) => {
      const photos = Array.isArray(v.photos) ? v.photos : [];
      const firstPhoto = photos[0]?.url || photos[0] || "";
      const externalImg = v.image_url && !v.image_url.startsWith("/") ? v.image_url : "";
      const image = firstPhoto || coverImageMap[v.name] || externalImg || "";
      vehicleMap[v.id] = { name: v.name, image };
    });
    setBookings((bRes.data || []).map((b: any) => ({
      ...b,
      vehicle_name: b.vehicle_id ? vehicleMap[b.vehicle_id]?.name || "" : "",
      vehicle_image: b.vehicle_id ? vehicleMap[b.vehicle_id]?.image || "" : "",
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Derive unique locations & vehicles for filter options
  const filterOptions = useMemo(() => {
    const pickupLocs = new Set<string>();
    const returnLocs = new Set<string>();
    const vehicles = new Set<string>();
    bookings.forEach((b) => {
      if (b.pickup_location) pickupLocs.add(b.pickup_location);
      if (b.return_location) returnLocs.add(b.return_location);
      if (b.vehicle_name) vehicles.add(b.vehicle_name);
    });
    return {
      pickupLocations: Array.from(pickupLocs).sort(),
      returnLocations: Array.from(returnLocs).sort(),
      vehicles: Array.from(vehicles).sort(),
    };
  }, [bookings]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = bookings.filter((b) => {
      const q = search.toLowerCase();
      const matchSearch = b.customer_name.toLowerCase().includes(q) ||
        (b.customer_email || "").toLowerCase().includes(q) ||
        (b.vehicle_name || "").toLowerCase().includes(q) ||
        (b.booking_number || "").toLowerCase().includes(q);
      const matchStatus = filters.status === "all" || b.status === filters.status;
      const matchPickup = filters.pickupLocation === "all" || b.pickup_location === filters.pickupLocation;
      const matchReturn = filters.returnLocation === "all" || b.return_location === filters.returnLocation;
      const matchVehicle = filters.vehicle === "all" || b.vehicle_name === filters.vehicle;

      // Overlap: booking interval [pickup, return] intersects [dateFrom, dateTo]
      let matchDateFrom = true;
      let matchDateTo = true;
      if (filters.dateFrom) {
        const returnDate = parseDateOnly(b.return_date);
        matchDateFrom = returnDate >= filters.dateFrom;
      }
      if (filters.dateTo) {
        const pickupDate = parseDateOnly(b.pickup_date);
        matchDateTo = pickupDate <= filters.dateTo;
      }

      return matchSearch && matchStatus && matchPickup && matchReturn && matchVehicle && matchDateFrom && matchDateTo;
    });

    // Prioridade por status: em andamento > ativa/confirmada (futuras próximas primeiro) > pendente > concluída > cancelada (sempre por último)
    const statusPriority = (s: string): number => {
      switch (s) {
        case "in_progress": return 0;
        case "active": return 1;
        case "confirmed": return 2;
        case "pending": return 3;
        case "completed": return 4;
        case "cancelled": return 5;
        default: return 3;
      }
    };

    result.sort((a, b) => {
      const pa = statusPriority(a.status);
      const pb = statusPriority(b.status);
      if (pa !== pb) return pa - pb;

      // Dentro do mesmo grupo de status: futuras/ativas pela data de retirada mais próxima primeiro
      if (pa <= 3) {
        const diff = parseDateOnly(a.pickup_date).getTime() - parseDateOnly(b.pickup_date).getTime();
        if (diff !== 0) return diff;
      } else {
        // concluídas e canceladas: mais recentes primeiro
        const diff = parseDateOnly(b.pickup_date).getTime() - parseDateOnly(a.pickup_date).getTime();
        if (diff !== 0) return diff;
      }

      // Desempate pelo sort selecionado pelo usuário
      const dir = filters.sortDir === "asc" ? 1 : -1;
      switch (filters.sortBy) {
        case "pickup_date": return dir * (parseDateOnly(a.pickup_date).getTime() - parseDateOnly(b.pickup_date).getTime());
        case "return_date": return dir * (parseDateOnly(a.return_date).getTime() - parseDateOnly(b.return_date).getTime());
        case "total_price": return dir * ((a.total_price || 0) - (b.total_price || 0));
        case "customer_name": return dir * a.customer_name.localeCompare(b.customer_name);
        default: return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    });

    return result;
  }, [bookings, search, filters]);

  // Reset page when filters/search change
  useEffect(() => { setPage(1); }, [search, filters, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => (viewMode === "table" ? filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize) : filtered),
    [filtered, currentPage, pageSize, viewMode]
  );

  useEffect(() => {
    sessionStorage.setItem("admin-bookings-page-size", String(pageSize));
  }, [pageSize]);

  const activeFilterCount = [
    filters.status !== "all",
    filters.pickupLocation !== "all",
    filters.returnLocation !== "all",
    filters.vehicle !== "all",
    !!filters.dateFrom,
    !!filters.dateTo,
    !!activePreset,
  ].filter(Boolean).length;

  const updateStatus = async (id: string, status: string) => {
    // Captura estado anterior para incluir no e-mail
    const prev = bookings.find((b) => b.id === id);
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Falha ao atualizar status", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Status atualizado" });

    // Dispara e-mail GoDrive (não bloqueia a UI)
    try {
      const { sendZeusEmail } = await import("@/lib/emails/sendZeusEmail");
      const statusLabel: Record<string, string> = {
        pending: "Pendente",
        confirmed: "Confirmada",
        active: "Ativa",
        in_progress: "Em andamento",
        completed: "Concluída",
        cancelled: "Cancelada",
      };
      const fmtMoney = (n: any) =>
        n == null ? "" : `USD ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const vehicleName = (prev as any)?.vehicle?.name || (prev as any)?.vehicle_name || "";
      const baseUrl = `${window.location.origin}/admin/bookings/${id}`;
      const stamp = new Date().toISOString();
      if (status === "cancelled") {
        sendZeusEmail({
          templateName: "booking-cancelled",
          idempotencyKey: `booking-cancelled:${id}:${stamp.slice(0, 16)}`,
          templateData: {
            bookingNumber: (prev as any)?.booking_number || "",
            customerName: (prev as any)?.customer_name || "",
            vehicleName,
            pickupDate: `${(prev as any)?.pickup_date ?? ""} · ${(prev as any)?.pickup_time ?? ""}`.trim(),
            returnDate: `${(prev as any)?.return_date ?? ""} · ${(prev as any)?.return_time ?? ""}`.trim(),
            totalPrice: fmtMoney((prev as any)?.total_price),
            cancelledAt: new Date().toLocaleString("pt-BR"),
            bookingUrl: baseUrl,
          },
        });
      } else if (prev && (prev as any).status !== status) {
        sendZeusEmail({
          templateName: "booking-updated",
          idempotencyKey: `booking-updated:${id}:${(prev as any).status}->${status}:${stamp.slice(0, 16)}`,
          templateData: {
            bookingNumber: (prev as any).booking_number || "",
            customerName: (prev as any).customer_name || "",
            vehicleName,
            changeSummary: "Status alterado",
            previousStatus: statusLabel[(prev as any).status] || (prev as any).status,
            newStatus: statusLabel[status] || status,
            pickupDate: `${(prev as any).pickup_date ?? ""} · ${(prev as any).pickup_time ?? ""}`.trim(),
            returnDate: `${(prev as any).return_date ?? ""} · ${(prev as any).return_time ?? ""}`.trim(),
            totalPrice: fmtMoney((prev as any).total_price),
            bookingUrl: baseUrl,
          },
        });
      }
    } catch (e) { console.error("[zeus-email] status change dispatch failed", e); }

    load();
  };

  const deleteBooking = async (id: string) => {
    const result = await deleteBookingSafe(id, {
      confirm: (m) => window.confirm(m),
      alert: (m) => window.alert(m),
    });

    if (result.ok === false) {
      if (result.reason === "error") {
        toast({ title: "Erro ao excluir", description: result.message, variant: "destructive" });
      }
      return;
    }

    toast({
      title: "Reserva excluída",
      description: result.cancelledCharge
        ? "Cobrança cancelada no Câmbio Real e reserva movida para a lixeira."
        : "Movida para a lixeira. Pode ser restaurada nos logs de auditoria.",
    });
    load();
  };

  // ─── Export Functions ───────────────────────────────────────
  const exportCSV = useCallback(() => {
    const headers = ["Cliente", "E-mail", "Veículo", "Retirada", "Horário Ret.", "Devolução", "Horário Dev.", "Local Retirada", "Local Devolução", "Valor", "Status"];
    const rows = filtered.map((b) => [
      b.customer_name,
      b.customer_email || "",
      b.vehicle_name || "",
      parseDateOnly(b.pickup_date).toLocaleDateString("pt-BR"),
      b.pickup_time || "",
      parseDateOnly(b.return_date).toLocaleDateString("pt-BR"),
      b.return_time || "",
      b.pickup_location || "",
      b.return_location || "",
      b.total_price?.toFixed(2) || "0",
      statusConfig[b.status]?.label || b.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservas-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado com sucesso" });
  }, [filtered]);

  const exportPDF = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc: jsPDFType = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Header background
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, pageW, 28, "F");

    // Gold accent line
    doc.setFillColor(196, 160, 56);
    doc.rect(0, 28, pageW, 1.5, "F");

    // GoDrive branding
    doc.setTextColor(196, 160, 56);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("GODRIVE", 15, 14);

    doc.setTextColor(180, 180, 180);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório de Reservas", 15, 21);

    // Date & filter info
    doc.setTextColor(140, 140, 140);
    doc.setFontSize(7);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageW - 15, 14, { align: "right" });
    doc.text(`${filtered.length} reservas filtradas de ${bookings.length} total`, pageW - 15, 20, { align: "right" });

    // Table header
    const startY = 36;
    const cols = [
      { label: "Cliente", w: 40 },
      { label: "Veículo", w: 35 },
      { label: "Retirada", w: 25 },
      { label: "Hr. Ret.", w: 15 },
      { label: "Devolução", w: 25 },
      { label: "Hr. Dev.", w: 15 },
      { label: "Local Retirada", w: 40 },
      { label: "Local Devolução", w: 40 },
      { label: "Valor", w: 20 },
      { label: "Status", w: 22 },
    ];
    let xOffset = 10;

    // Header row
    doc.setFillColor(40, 40, 40);
    doc.rect(10, startY, pageW - 20, 8, "F");
    doc.setTextColor(196, 160, 56);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    cols.forEach((col) => {
      doc.text(col.label.toUpperCase(), xOffset + 1.5, startY + 5.5);
      xOffset += col.w;
    });

    // Data rows
    let y = startY + 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);

    filtered.forEach((b, i) => {
      if (y > pageH - 20) {
        doc.addPage();
        y = 15;
        // Re-draw header on new page
        doc.setFillColor(40, 40, 40);
        doc.rect(10, y, pageW - 20, 8, "F");
        doc.setTextColor(196, 160, 56);
        doc.setFont("helvetica", "bold");
        let xH = 10;
        cols.forEach((col) => {
          doc.text(col.label.toUpperCase(), xH + 1.5, y + 5.5);
          xH += col.w;
        });
        doc.setFont("helvetica", "normal");
        y += 8;
      }

      // Alternating row bg
      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(10, y, pageW - 20, 7, "F");
      }

      doc.setTextColor(50, 50, 50);
      xOffset = 10;
      const vals = [
        b.customer_name,
        b.vehicle_name || "",
        parseDateOnly(b.pickup_date).toLocaleDateString("pt-BR"),
        b.pickup_time || "",
        parseDateOnly(b.return_date).toLocaleDateString("pt-BR"),
        b.return_time || "",
        b.pickup_location || "",
        b.return_location || "",
        `$${(b.total_price || 0).toFixed(2)}`,
        statusConfig[b.status]?.label || b.status,
      ];
      vals.forEach((val, ci) => {
        const truncated = val.length > Math.floor(cols[ci].w / 2) ? val.substring(0, Math.floor(cols[ci].w / 2)) + "…" : val;
        doc.text(truncated, xOffset + 1.5, y + 4.8);
        xOffset += cols[ci].w;
      });
      y += 7;
    });

    // Footer
    const totalRevenue = filtered.reduce((s, b) => s + (b.total_price || 0), 0);
    y += 5;
    if (y > pageH - 15) { doc.addPage(); y = 15; }
    doc.setFillColor(26, 26, 26);
    doc.rect(10, y, pageW - 20, 10, "F");
    doc.setTextColor(196, 160, 56);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", 15, y + 6.5);
    doc.text(`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, pageW - 15, y + 6.5, { align: "right" });

    // Page footer
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setTextColor(160, 160, 160);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(`GoDrive. rentalcarsystem.lovable.app`, 15, pageH - 5);
      doc.text(`Página ${p} de ${totalPages}`, pageW - 15, pageH - 5, { align: "right" });
    }

    doc.save(`reservas-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF exportado com sucesso" });
  }, [filtered, bookings.length]);

  const viewModes = [
    { key: "table" as const, label: "Lista", icon: List },
    { key: "calendar" as const, label: "Mês", icon: CalendarDays },
    { key: "week" as const, label: "Semana", icon: Clock },
  ];

  const FilterOption = ({ label, value, current, onChange }: { label: string; value: string; current: string; onChange: (v: string) => void }) => (
    <button
      onClick={() => onChange(value)}
      className={`flex items-center justify-between w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
        current === value ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <span className="truncate">{label}</span>
      {current === value && <Check size={12} className="shrink-0 ml-2" />}
    </button>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="admin-h1">Reservas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{bookings.length} reservas • {filtered.length} exibidas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate("/admin/bookings/new")}
            className="flex items-center gap-1.5 h-8 sm:h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all"
          >
            <Plus size={14} /> <span>Nova reserva</span>
          </button>
          {/* Export. esconde quando o usuário não pode ver valores (CSV/PDF contêm financeiro) */}
          {!hideFin && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 h-8 sm:h-9 px-3 rounded-lg border border-border/40 bg-card/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/60 transition-all">
                  <Download size={13} /> <span className="hidden sm:inline">Exportar</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[180px] p-1.5" align="end">
                <button onClick={exportCSV} className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <FileSpreadsheet size={14} /> Exportar CSV
                </button>
                <button onClick={exportPDF} className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <FileText size={14} /> Exportar PDF
                </button>
              </PopoverContent>
            </Popover>
          )}
          {/* View toggle */}
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/30">
            {viewModes.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 rounded-md font-medium transition-all ${
                  viewMode === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={13} /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preset chips. only on table view */}
      {viewMode === "table" && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => {
              const active = activePreset === key;
              const baseCls = `text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card/50 border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60"
              }`;

              if (key === "custom") {
                const rangeLabel = filters.dateFrom && filters.dateTo
                  ? `${format(filters.dateFrom, "dd/MM/yy")}. ${format(filters.dateTo, "dd/MM/yy")}`
                  : filters.dateFrom
                    ? `Desde ${format(filters.dateFrom, "dd/MM/yy")}`
                    : PRESET_LABELS.custom;
                return (
                  <Popover key={key}>
                    <PopoverTrigger asChild>
                      <button
                        onClick={() => setActivePreset("custom")}
                        className={`${baseCls} inline-flex items-center gap-1`}
                      >
                        <CalendarIcon size={11} />
                        {rangeLabel}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={{ from: filters.dateFrom, to: filters.dateTo }}
                        onSelect={(r) => {
                          setActivePreset("custom");
                          setFilters((f) => ({ ...f, dateFrom: r?.from, dateTo: r?.to }));
                        }}
                        numberOfMonths={2}
                        locale={ptBR}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                      <div className="flex items-center justify-between gap-2 p-2 border-t border-border/40">
                        <span className="text-[10px] text-muted-foreground px-2">
                          Selecione um intervalo
                        </span>
                        {(filters.dateFrom || filters.dateTo) && (
                          <button
                            onClick={() => {
                              setFilters((f) => ({ ...f, dateFrom: undefined, dateTo: undefined }));
                              setActivePreset(null);
                            }}
                            className="text-[10px] text-destructive hover:text-destructive/80 font-medium px-2 py-1 inline-flex items-center gap-1"
                          >
                            <X size={10} /> Limpar
                          </button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              }

              return (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={baseCls}
                >
                  {PRESET_LABELS[key]}
                </button>
              );
            })}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-[11px] px-2.5 py-1 rounded-full border border-destructive/30 text-destructive hover:bg-destructive/10 font-medium transition-all flex items-center gap-1 ml-1"
              >
                <X size={11} /> Limpar todos os filtros
              </button>
            )}
          </div>

          {/* Status chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilters((f) => ({ ...f, status: "all" }))}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                filters.status === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card/50 border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60"
              }`}
            >
              Todos status
            </button>
            {Object.entries(statusConfig).map(([key, val]) => {
              const active = filters.status === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilters((f) => ({ ...f, status: active ? "all" : key }))}
                  className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all inline-flex items-center gap-1.5 ${
                    active
                      ? `${val.calBg} ${val.calText} border-current/30`
                      : "bg-card/50 border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${val.calBg.replace("/15", "").replace("/10", "")} ${val.calText}`} style={{ backgroundColor: "currentColor" }} />
                  {val.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Smart Filters Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente, e-mail ou veículo..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/40 bg-card/50 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
        </div>

        {/* Filters Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button className={`flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-xs font-medium transition-all ${
              activeFilterCount > 0
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/40 bg-card/50 text-muted-foreground hover:text-foreground hover:border-border/60"
            }`}>
              <SlidersHorizontal size={14} />
              Filtros
              {activeFilterCount > 0 && (
                <span className="w-4.5 h-4.5 rounded-full bg-primary text-primary-foreground text-[9px] font-medium flex items-center justify-center ml-0.5">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="end">
            <div className="p-3 border-b border-border/30 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Filtrar reservas</span>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-[10px] text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                >
                  <X size={10} /> Limpar filtros
                </button>
              )}
            </div>
            <div className="p-3 space-y-4 max-h-[400px] overflow-y-auto">
              {/* Status */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Status</p>
                <div className="space-y-0.5">
                  <FilterOption label="Todos" value="all" current={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} />
                  {Object.entries(statusConfig).map(([key, val]) => (
                    <FilterOption key={key} label={val.label} value={key} current={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} />
                  ))}
                </div>
              </div>

              {/* Pickup Location */}
              {filterOptions.pickupLocations.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Local de Retirada</p>
                  <div className="space-y-0.5">
                    <FilterOption label="Todos" value="all" current={filters.pickupLocation} onChange={(v) => setFilters({ ...filters, pickupLocation: v })} />
                    {filterOptions.pickupLocations.map((loc) => (
                      <FilterOption key={loc} label={loc} value={loc} current={filters.pickupLocation} onChange={(v) => setFilters({ ...filters, pickupLocation: v })} />
                    ))}
                  </div>
                </div>
              )}

              {/* Return Location */}
              {filterOptions.returnLocations.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Local de Devolução</p>
                  <div className="space-y-0.5">
                    <FilterOption label="Todos" value="all" current={filters.returnLocation} onChange={(v) => setFilters({ ...filters, returnLocation: v })} />
                    {filterOptions.returnLocations.map((loc) => (
                      <FilterOption key={loc} label={loc} value={loc} current={filters.returnLocation} onChange={(v) => setFilters({ ...filters, returnLocation: v })} />
                    ))}
                  </div>
                </div>
              )}

              {/* Vehicle */}
              {filterOptions.vehicles.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Veículo</p>
                  <div className="space-y-0.5">
                    <FilterOption label="Todos" value="all" current={filters.vehicle} onChange={(v) => setFilters({ ...filters, vehicle: v })} />
                    {filterOptions.vehicles.map((v) => (
                      <FilterOption key={v} label={v} value={v} current={filters.vehicle} onChange={(vl) => setFilters({ ...filters, vehicle: vl })} />
                    ))}
                  </div>
                </div>
              )}

              {/* Date Range */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Período de Retirada</p>
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn(
                        "h-8 px-2.5 rounded-md border text-[10px] flex items-center gap-1.5 transition-colors w-full",
                        filters.dateFrom ? "border-primary/30 text-primary" : "border-border/30 text-muted-foreground"
                      )}>
                        <CalendarIcon size={11} />
                        {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yy") : "De"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateFrom}
                        onSelect={(d) => { setActivePreset("custom"); setFilters({ ...filters, dateFrom: d }); }}
                        className={cn("p-3 pointer-events-auto")}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn(
                        "h-8 px-2.5 rounded-md border text-[10px] flex items-center gap-1.5 transition-colors w-full",
                        filters.dateTo ? "border-primary/30 text-primary" : "border-border/30 text-muted-foreground"
                      )}>
                        <CalendarIcon size={11} />
                        {filters.dateTo ? format(filters.dateTo, "dd/MM/yy") : "Até"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={filters.dateTo}
                        onSelect={(d) => { setActivePreset("custom"); setFilters({ ...filters, dateTo: d }); }}
                        className={cn("p-3 pointer-events-auto")}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Sort Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg border border-border/40 bg-card/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/60 transition-all">
              <ArrowUpDown size={13} />
              <span className="hidden sm:inline">{sortLabels[filters.sortBy]}</span>
              <span className="sm:hidden">Ordenar</span>
              <span className="text-[9px] opacity-60">{filters.sortDir === "desc" ? "↓" : "↑"}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="end">
            <div className="p-3 border-b border-border/30">
              <span className="text-xs font-medium text-foreground">Ordenar por</span>
            </div>
            <div className="p-2 space-y-0.5">
              {(Object.entries(sortLabels) as [SortField, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilters({
                    ...filters,
                    sortBy: key,
                    sortDir: filters.sortBy === key ? (filters.sortDir === "desc" ? "asc" : "desc") : "desc",
                  })}
                  className={`flex items-center justify-between w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                    filters.sortBy === key ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{label}</span>
                  {filters.sortBy === key && (
                    <span className="text-[10px] font-medium">{filters.sortDir === "desc" ? "↓ Recente" : "↑ Antigo"}</span>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.status !== "all" && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
                {statusConfig[filters.status]?.label}
                <button onClick={() => setFilters({ ...filters, status: "all" })} className="hover:text-primary/70"><X size={10} /></button>
              </span>
            )}
            {filters.pickupLocation !== "all" && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
                Retirada: {filters.pickupLocation}
                <button onClick={() => setFilters({ ...filters, pickupLocation: "all" })} className="hover:text-primary/70"><X size={10} /></button>
              </span>
            )}
            {filters.returnLocation !== "all" && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
                Devolução: {filters.returnLocation}
                <button onClick={() => setFilters({ ...filters, returnLocation: "all" })} className="hover:text-primary/70"><X size={10} /></button>
              </span>
            )}
            {filters.vehicle !== "all" && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
                {filters.vehicle}
                <button onClick={() => setFilters({ ...filters, vehicle: "all" })} className="hover:text-primary/70"><X size={10} /></button>
              </span>
            )}
            {filters.dateFrom && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
                De: {format(filters.dateFrom, "dd/MM/yy")}
                <button onClick={() => setFilters({ ...filters, dateFrom: undefined })} className="hover:text-primary/70"><X size={10} /></button>
              </span>
            )}
            {filters.dateTo && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
                Até: {format(filters.dateTo, "dd/MM/yy")}
                <button onClick={() => setFilters({ ...filters, dateTo: undefined })} className="hover:text-primary/70"><X size={10} /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={10} columns={[
          { width: "w-24" }, { width: "w-28" }, { width: "w-16" }, { width: "w-20" },
          { width: "w-14", align: "right" }, { width: "w-16" }, { width: "w-24" },
          { width: "w-10", align: "center" }, { width: "w-6" },
        ]} />
      ) : viewMode === "calendar" ? (
        <CalendarView bookings={filtered} navigate={navigate} />
      ) : viewMode === "week" ? (
        <WeeklyView bookings={filtered} navigate={navigate} />
      ) : (
        /* Table */
        <Card className="bg-card/80 border-border/30 overflow-hidden">
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              bookings.length > 0 ? (
                <EmptyState
                  icon={Search}
                  title="Nenhuma reserva encontrada"
                  description="Nenhum resultado para os filtros aplicados. Tente ajustar os critérios de busca."
                  actionLabel="Limpar filtros"
                  onAction={clearAllFilters}
                  compact
                />
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="Nenhuma reserva registrada"
                  description="As reservas aparecerão aqui assim que forem criadas pelo site ou manualmente."
                  compact
                />
              )
            ) : (
              <>
                {/* Mobile: native-style cards */}
                <div className="md:hidden p-3 space-y-3 bg-background">
                  {paginated.map((b) => (
                    <MobileBookingCard
                      key={b.id}
                      booking={b}
                      onOpen={() => navigate(`/admin/bookings/${b.id}`)}
                    />
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/20">
                      <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap min-w-[200px]">Cliente</th>
                      <th className="px-3 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap border-l-2 border-border/60 pl-5">Venda</th>
                      <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-l-2 border-border/60 pl-5">Veículo</th>
                      <th className="px-3 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap border-l-2 border-border/60 pl-5">Retirada</th>
                      <th className="px-3 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">Hora</th>
                      <th className="px-3 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap border-l-2 border-border/60 pl-5">Devolução</th>
                      <th className="px-3 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">Hora</th>
                      <th className="px-3 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-l-2 border-border/60 pl-5">Local</th>
                      {!hideFin && <th className="px-3 py-3 text-right text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap border-l-2 border-border/60 pl-5">Total</th>}
                      {!hideFin && <th className="px-3 py-3 text-right text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap border-l-2 border-border/60 pl-5">Caução</th>}
                      {!hideFin && <th className="px-3 py-3 text-right text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap border-l-2 border-border/60 pl-5">Franquia</th>}
                      <th className="px-3 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-l-2 border-border/60 pl-5">Status</th>
                      <th className="px-3 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold min-w-[120px] border-l-2 border-border/60 pl-5">Progresso</th>
                      <th className="px-3 py-3 text-center text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap border-l-2 border-border/60 pl-5">Inspeção</th>
                      <th className="px-3 py-3 text-center text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap border-l-2 border-border/60 pl-5">Laudo</th>
                      <th className="px-5 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((b) => {
                      const progress = getBookingProgress(b.pickup_date, b.return_date, b.status);
                      const sc = statusConfig[b.status] || statusConfig.pending;
                      return (
                        <tr
                          key={b.id}
                          onClick={() => navigate(`/admin/bookings/${b.id}`)}
                          className="border-b border-border/10 hover:bg-muted/20 transition-colors cursor-pointer group"
                        >
                          <td className="px-5 py-3.5 whitespace-nowrap min-w-[200px]">
                            <div className="flex items-center gap-2.5">
                              <PersonAvatar name={b.customer_name} size="sm" />
                              <p className="text-foreground font-medium text-[13px] truncate max-w-[220px]">{formatName(b.customer_name)}</p>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-muted-foreground tabular-nums text-xs whitespace-nowrap border-l-2 border-border/60 pl-5">
                            {(() => {
                              const turoBookedAt = (b.addons as any)?.turo_booked_at as string | undefined;
                              const d = new Date(turoBookedAt || b.created_at);
                              return (
                                <div className="leading-tight">
                                  <div className="text-foreground/85 text-[12px]">{d.toLocaleDateString("pt-BR")}</div>
                                  <div className="text-[10px] text-muted-foreground/70">{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                                </div>
                              );
                            })()}
                          </td>

                          <td className="px-5 py-3.5 border-l-2 border-border/60">
                            <div className="flex items-center gap-2.5 min-w-[160px]">
                              {b.vehicle_image ? (
                                <img
                                  src={b.vehicle_image}
                                  alt={b.vehicle_name || ""}
                                  className="w-12 h-9 rounded-md object-cover bg-muted border border-border/30 flex-shrink-0"
                                  loading="lazy"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <div className="w-12 h-9 rounded-md bg-muted border border-border/30 flex-shrink-0 flex items-center justify-center">
                                  <Car className="w-4 h-4 text-muted-foreground/50" />
                                </div>
                              )}
                              <span className="text-foreground text-[13px] font-medium truncate">{b.vehicle_name || ""}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-muted-foreground tabular-nums text-xs whitespace-nowrap border-l-2 border-border/60 pl-5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-emerald-500 text-[10px]">→</span>
                              {parseDateOnly(b.pickup_date).toLocaleDateString("pt-BR")}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-muted-foreground tabular-nums text-xs whitespace-nowrap">
                            {b.pickup_time ? b.pickup_time.slice(0, 5) : ""}
                          </td>
                          <td className="px-3 py-3.5 text-muted-foreground tabular-nums text-xs whitespace-nowrap border-l-2 border-border/60 pl-5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-orange-500 text-[10px]">←</span>
                              {parseDateOnly(b.return_date).toLocaleDateString("pt-BR")}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-muted-foreground tabular-nums text-xs whitespace-nowrap">
                            {b.return_time ? b.return_time.slice(0, 5) : ""}
                          </td>
                          <td className="px-3 py-3.5 text-xs max-w-[240px] border-l-2 border-border/60 pl-5">
                            {(() => {
                              const parseLoc = (raw: string | null) => {
                                if (!raw) return null;
                                const [addrRaw, ...termParts] = raw.split(". ");
                                const addr = (addrRaw || "").trim();
                                const terminal = termParts.join(". ").trim();
                                const isAirport = /airport|aeroporto|\bMCO\b|\bMIA\b|\bTPA\b|\bFLL\b|\bSFB\b/i.test(addr);
                                return { addr, terminal, isAirport };
                              };
                              const pu = parseLoc(b.pickup_location);
                              const rt = parseLoc(b.return_location);
                              const sameLocation = pu && rt && pu.addr === rt.addr && pu.terminal === rt.terminal;
                              const Row = ({ data, arrow, color }: { data: NonNullable<ReturnType<typeof parseLoc>>; arrow: string; color: string }) => (
                                <div className="flex items-start gap-1.5 min-w-0">
                                  <span className={`${color} text-[10px] mt-0.5 flex-shrink-0`}>{arrow}</span>
                                  {data.isAirport ? (
                                    <Plane className="w-3 h-3 text-muted-foreground/70 mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <MapPin className="w-3 h-3 text-muted-foreground/70 mt-0.5 flex-shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="text-foreground/85 text-[12px] leading-tight truncate" title={data.addr}>{data.addr}</div>
                                    {data.terminal && (
                                      <div className="mt-0.5">
                                        <span className="inline-flex items-center rounded-sm bg-primary/10 text-primary text-[9px] font-medium px-1.5 py-0.5 leading-none tracking-wide uppercase">
                                          {data.terminal}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                              if (!pu && !rt) return <span className="text-muted-foreground/50"></span>;
                              if (sameLocation && pu) {
                                return (
                                  <div className="flex items-start gap-1.5 min-w-0">
                                    {pu.isAirport ? (
                                      <Plane className="w-3.5 h-3.5 text-muted-foreground/70 mt-0.5 flex-shrink-0" />
                                    ) : (
                                      <MapPin className="w-3.5 h-3.5 text-muted-foreground/70 mt-0.5 flex-shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="text-foreground/85 text-[12px] leading-tight truncate" title={pu.addr}>{pu.addr}</div>
                                      {pu.terminal && (
                                        <div className="mt-0.5">
                                          <span className="inline-flex items-center rounded-sm bg-primary/10 text-primary text-[9px] font-medium px-1.5 py-0.5 leading-none tracking-wide uppercase">
                                            {pu.terminal}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div className="space-y-1">
                                  {pu && <Row data={pu} arrow="→" color="text-emerald-500" />}
                                  {rt && <Row data={rt} arrow="←" color="text-orange-500" />}
                                </div>
                              );
                            })()}
                          </td>
                          {!hideFin && (
                            <td className="px-3 py-3.5 text-right tabular-nums whitespace-nowrap border-l-2 border-border/60 pl-5">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-foreground font-semibold text-[13px]">
                                  {b.total_price != null ? `$${Number(b.total_price).toFixed(2)}` : ""}
                                </span>
                                {tollTotals[b.id] > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium" title="Pedágios E-Pass vinculados">
                                    🛣 ${tollTotals[b.id].toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          {!hideFin && (
                            <td className="px-3 py-3.5 text-right tabular-nums whitespace-nowrap border-l-2 border-border/60 pl-5">
                              {(b.deposit_amount ?? 0) > 0 ? (
                                <div className="leading-tight">
                                  <div className="text-[12px] text-foreground/80">${Number(b.deposit_amount).toFixed(0)}</div>
                                  {b.deposit_refund_days ? (
                                    <div className="text-[10px] text-muted-foreground/70">{b.deposit_refund_days}d</div>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/50 text-xs"></span>
                              )}
                            </td>
                          )}
                          {!hideFin && (
                            <td className="px-3 py-3.5 text-right tabular-nums whitespace-nowrap border-l-2 border-border/60 pl-5">
                              {(b.franchise_amount ?? 0) > 0 ? (
                                <span className="text-[12px] text-foreground/80">${Number(b.franchise_amount).toFixed(0)}</span>
                              ) : (
                                <span className="text-muted-foreground/50 text-xs"></span>
                              )}
                            </td>
                          )}
                          <td className="px-5 py-3.5 border-l-2 border-border/60" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={b.status}
                              onChange={(e) => updateStatus(b.id, e.target.value)}
                              className={`text-[10px] font-semibold rounded-md px-2 py-1 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/30 ${sc.color}`}
                            >
                              {Object.entries(statusConfig).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-5 py-3.5 border-l-2 border-border/60">
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    b.status === "completed" ? "bg-emerald-500"
                                    : b.status === "active" || b.status === "in_progress" ? "bg-amber-500"
                                    : "bg-muted-foreground/20"
                                  }`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground font-medium tabular-nums min-w-[28px] text-right">{progress}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 border-l-2 border-border/60" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => navigate(`/admin/inspection/${b.id}?type=checkin`)}
                                className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-md bg-primary/8 text-primary hover:bg-primary/15 transition-colors font-medium border border-primary/15 whitespace-nowrap"
                                title="Entrega"
                              >
                                <LogIn size={11} /> Entrega
                              </button>
                              <button
                                onClick={() => navigate(`/admin/inspection/${b.id}?type=checkout`)}
                                className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium border border-border/30 whitespace-nowrap"
                                title="Devolução"
                              >
                                <LogOut size={11} /> Devolução
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 border-l-2 border-border/60" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => navigate(`/admin/inspection/report/${b.id}`)}
                                className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium border border-border/30 whitespace-nowrap"
                                title="Laudo completo do serviço"
                              >
                                <FileText size={11} /> Laudo
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => deleteBooking(b.id)}
                              className="text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>

                {/* Pager */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border/30 bg-muted/10">
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    Mostrando <span className="text-foreground font-medium">{(currentPage - 1) * pageSize + 1}</span>
                    {". "}
                    <span className="text-foreground font-medium">{Math.min(currentPage * pageSize, filtered.length)}</span>
                    {" de "}
                    <span className="text-foreground font-medium">{filtered.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-muted-foreground">Por página</label>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="text-[11px] rounded-md border border-border/40 bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    >
                      {[25, 50, 100, 200].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => setPage(1)}
                        disabled={currentPage === 1}
                        className="px-2 py-1 text-[11px] rounded-md border border-border/40 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                      >«</button>
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2 py-1 text-[11px] rounded-md border border-border/40 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                      >‹ Anterior</button>
                      <span className="text-[11px] text-muted-foreground tabular-nums px-2">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 text-[11px] rounded-md border border-border/40 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                      >Próxima ›</button>
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 text-[11px] rounded-md border border-border/40 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                      >»</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      
    </div>
  );
}
