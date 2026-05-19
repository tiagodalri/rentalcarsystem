import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Car } from "lucide-react";
import { addDays, format, parseISO, startOfDay, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Vehicle = { id: string; name: string; category: string; status: string };
type Booking = {
  id: string;
  vehicle_id: string;
  customer_name: string;
  pickup_date: string;
  return_date: string;
  status: string;
  booking_number: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/70 hover:bg-yellow-500 border-yellow-600",
  confirmed: "bg-blue-500/70 hover:bg-blue-500 border-blue-600",
  active: "bg-emerald-500/70 hover:bg-emerald-500 border-emerald-600",
  in_progress: "bg-amber-500/70 hover:bg-amber-500 border-amber-600",
  completed: "bg-zinc-500/60 hover:bg-zinc-500 border-zinc-600",
  cancelled: "bg-red-500/40 hover:bg-red-500/60 border-red-600",
};

const DAYS_WINDOW = 30;
const DAY_WIDTH = 36; // px
const ROW_HEIGHT = 44; // px

export default function AdminFleetGantt() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));

  useEffect(() => {
    (async () => {
      setLoading(true);
      const endDate = addDays(startDate, DAYS_WINDOW + 7);
      const [v, b] = await Promise.all([
        supabase.from("vehicles").select("id, name, category, status").neq("status", "sold").order("name"),
        supabase
          .from("bookings")
          .select("id, vehicle_id, customer_name, pickup_date, return_date, status, booking_number")
          .lte("pickup_date", format(endDate, "yyyy-MM-dd"))
          .gte("return_date", format(addDays(startDate, -7), "yyyy-MM-dd"))
          .neq("status", "cancelled"),
      ]);
      setVehicles((v.data as Vehicle[]) || []);
      setBookings((b.data as Booking[]) || []);
      setLoading(false);
    })();
  }, [startDate]);

  const days = useMemo(() => {
    return Array.from({ length: DAYS_WINDOW }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  const today = startOfDay(new Date());

  const getBookingPosition = (b: Booking) => {
    const pickup = startOfDay(parseISO(b.pickup_date));
    const ret = startOfDay(parseISO(b.return_date));
    const offset = differenceInCalendarDays(pickup, startDate);
    const length = differenceInCalendarDays(ret, pickup) + 1;
    const clippedStart = Math.max(0, offset);
    const clippedEnd = Math.min(DAYS_WINDOW, offset + length);
    if (clippedEnd <= 0 || clippedStart >= DAYS_WINDOW) return null;
    return {
      left: clippedStart * DAY_WIDTH,
      width: (clippedEnd - clippedStart) * DAY_WIDTH - 2,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Calendário da Frota</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão Gantt de ocupação por veículo nos próximos {DAYS_WINDOW} dias</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setStartDate(addDays(startDate, -7))} className="h-9 w-9 flex items-center justify-center rounded-lg border border-border/40 bg-card hover:bg-muted transition-colors text-muted-foreground">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setStartDate(startOfDay(new Date()))} className="h-9 px-3 rounded-lg border border-border/40 bg-card hover:bg-muted transition-colors text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <CalendarIcon size={12} /> Hoje
          </button>
          <button onClick={() => setStartDate(addDays(startDate, 7))} className="h-9 w-9 flex items-center justify-center rounded-lg border border-border/40 bg-card hover:bg-muted transition-colors text-muted-foreground">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        {Object.entries({ pending: "Pendente", confirmed: "Confirmada", in_progress: "Em andamento", completed: "Concluída" }).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded-sm ${STATUS_COLORS[k].split(" ")[0]}`} />
            {label}
          </span>
        ))}
      </div>

      <Card className="bg-card/60 border-border/30 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : vehicles.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhum veículo encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header — days */}
              <div className="flex border-b border-border/30 bg-muted/20 sticky top-0 z-10">
                <div className="w-48 shrink-0 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/30">
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
                        className={`shrink-0 border-r border-border/20 px-1 py-1 text-center ${isToday ? "bg-primary/10" : isWeekend ? "bg-muted/30" : ""}`}
                      >
                        <div className={`text-[9px] uppercase ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                          {format(d, "EEE", { locale: ptBR }).slice(0, 3)}
                        </div>
                        <div className={`text-[11px] tabular-nums ${isToday ? "text-primary font-bold" : "text-foreground"}`}>
                          {format(d, "dd")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows — vehicles */}
              {vehicles.map((v) => {
                const vBookings = bookings.filter(b => b.vehicle_id === v.id);
                return (
                  <div key={v.id} className="flex border-b border-border/10 hover:bg-muted/10 transition-colors">
                    <button
                      onClick={() => navigate(`/admin/fleet/${v.id}`)}
                      style={{ height: ROW_HEIGHT }}
                      className="w-48 shrink-0 px-3 flex items-center gap-2 border-r border-border/30 text-left hover:text-primary"
                    >
                      <Car size={13} className="text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground truncate">{v.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{v.category}</div>
                      </div>
                    </button>
                    <div className="relative flex" style={{ height: ROW_HEIGHT }}>
                      {days.map((d, i) => {
                        const isToday = d.getTime() === today.getTime();
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div
                            key={i}
                            style={{ width: DAY_WIDTH }}
                            className={`shrink-0 border-r border-border/10 ${isToday ? "bg-primary/5" : isWeekend ? "bg-muted/10" : ""}`}
                          />
                        );
                      })}
                      {/* Booking bars */}
                      {vBookings.map(b => {
                        const pos = getBookingPosition(b);
                        if (!pos) return null;
                        const color = STATUS_COLORS[b.status] || STATUS_COLORS.confirmed;
                        return (
                          <button
                            key={b.id}
                            onClick={() => navigate(`/admin/bookings/${b.id}`)}
                            style={{ left: pos.left + 2, width: pos.width, top: 6, height: ROW_HEIGHT - 12 }}
                            className={`absolute rounded-md border ${color} px-2 text-[10px] font-semibold text-white truncate flex items-center transition-all shadow-sm hover:shadow-md hover:z-20`}
                            title={`${b.booking_number || ""} • ${b.customer_name} • ${b.pickup_date} → ${b.return_date}`}
                          >
                            {b.customer_name}
                          </button>
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
    </div>
  );
}
