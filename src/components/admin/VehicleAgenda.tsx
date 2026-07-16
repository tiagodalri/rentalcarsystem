import { formatPersonName } from "@/lib/formatName";
import { parseDateOnly } from "@/lib/dateOnly";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, Circle, MapPin, Clock } from "lucide-react";

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
};

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-red-500/10", text: "text-red-400", label: "Pendente" },
  confirmed: { bg: "bg-red-500/15", text: "text-red-500", label: "Reservada" },
  active: { bg: "bg-emerald-500/15", text: "text-emerald-600", label: "Ativa" },
  in_progress: { bg: "bg-amber-500/15", text: "text-amber-600", label: "Em andamento" },
  completed: { bg: "bg-muted", text: "text-muted-foreground", label: "Concluída" },
  cancelled: { bg: "bg-destructive/15", text: "text-destructive", label: "Cancelada" },
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function VehicleAgenda({ bookings }: { bookings: Booking[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const activeBookings = useMemo(
    () => bookings.filter((b) => b.status !== "cancelled"),
    [bookings]
  );

  const getBookingsForDay = (day: number) => {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    return activeBookings.filter((b) => {
      const pickup = parseDateOnly(b.pickup_date);
      pickup.setHours(0, 0, 0, 0);
      const returnD = parseDateOnly(b.return_date);
      returnD.setHours(0, 0, 0, 0);
      return date >= pickup && date <= returnD;
    });
  };

  const getDayType = (day: number, dayBookings: Booking[]) => {
    if (dayBookings.length === 0) return "available";
    const hasActive = dayBookings.some((b) => ["active", "in_progress"].includes(b.status));
    if (hasActive) return "rented";
    const hasConfirmed = dayBookings.some((b) => ["confirmed", "pending"].includes(b.status));
    if (hasConfirmed) return "reserved";
    return "past";
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };
  const goToday = () => { setMonth(today.getMonth()); setYear(today.getFullYear()); };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // upcoming bookings for sidebar
  const upcoming = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return activeBookings
      .filter((b) => parseDateOnly(b.return_date) >= now)
      .sort((a, b) => parseDateOnly(a.pickup_date).getTime() - parseDateOnly(b.pickup_date).getTime())
      .slice(0, 8);
  }, [activeBookings]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Calendar */}
      <Card className="lg:col-span-2 border-border/40">
        <CardContent className="p-4 sm:p-6">
          {/* Nav */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth} aria-label="Mês anterior">
                <ChevronLeft size={16} />
              </Button>
              <h3 className="text-base sm:text-lg font-medium text-foreground min-w-[160px] text-center">
                {MONTHS[month]} {year}
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth} aria-label="Próximo mês">
                <ChevronRight size={16} />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={goToday}>
              Hoje
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-px">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square p-0.5" />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayBookings = getBookingsForDay(day);
              const type = getDayType(day, dayBookings);
              const today_ = isToday(day);

              const bgClass =
                type === "rented"
                  ? "bg-amber-500/20"
                  : type === "reserved"
                    ? "bg-red-500/15"
                    : type === "past"
                      ? "bg-muted/50"
                      : "bg-background hover:bg-muted/30";

              const borderClass = today_
                ? "border-2 border-primary"
                : type === "rented"
                  ? "border border-amber-500/40"
                  : type === "reserved"
                    ? "border border-red-500/30"
                    : type === "past"
                      ? "border border-border/30"
                      : "border border-border/20";

              return (
                <div
                  key={day}
                  className={`aspect-square p-1 sm:p-1.5 rounded-lg transition-colors relative group ${bgClass} ${borderClass}`}
                >
                  <span
                    className={`text-[10px] sm:text-xs font-medium ${
                      today_ ? "text-primary font-medium" : type === "rented" || type === "reserved" ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {day}
                  </span>
                  {dayBookings.length > 0 && (
                    <div className="absolute bottom-0.5 left-0.5 right-0.5 flex gap-0.5 justify-center">
                      {dayBookings.slice(0, 3).map((b) => {
                        const sc = statusColors[b.status] || statusColors.pending;
                        return (
                          <Circle key={b.id} size={4} className={`fill-current ${sc.text}`} />
                        );
                      })}
                    </div>
                  )}
                  {dayBookings.length > 0 && (
                    <div className="hidden group-hover:block absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-lg bg-popover border border-border shadow-xl">
                      {dayBookings.map((b) => {
                        const sc = statusColors[b.status] || statusColors.pending;
                        return (
                          <div key={b.id} className="text-[10px] mb-2 last:mb-0 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${sc.text}`}>{sc.label}</span>
                              {b.total_price && (
                                <span className="text-primary font-semibold">${b.total_price.toLocaleString("pt-BR")}</span>
                              )}
                            </div>
                            <p className="text-foreground font-semibold truncate">{formatPersonName(b.customer_name)}</p>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock size={8} className="shrink-0" />
                              <span>
                                {parseDateOnly(b.pickup_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                                {b.pickup_time ? ` ${b.pickup_time}` : ""} →{" "}
                                {parseDateOnly(b.return_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                                {b.return_time ? ` ${b.return_time}` : ""}
                              </span>
                            </div>
                            {(b.pickup_location || b.return_location) && (
                              <div className="flex items-start gap-1 text-muted-foreground">
                                <MapPin size={8} className="shrink-0 mt-0.5" />
                                <span className="truncate">
                                  {b.pickup_location || ""} → {b.return_location || ""}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-border/30">
            {[
              { color: "bg-emerald-500/30 border-emerald-500/50", label: "Disponível" },
              { color: "bg-amber-500/30 border-amber-500/50", label: "Alugado" },
              { color: "bg-red-500/25 border-red-500/40", label: "Reservado" },
              { color: "bg-muted border-border/40", label: "Concluída" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm border ${l.color}`} />
                <span className="text-[10px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sidebar: upcoming bookings */}
      <Card className="border-border/40">
        <CardContent className="p-4 sm:p-5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3">
            <Calendar size={12} className="text-primary" />
            Próximas reservas
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma reserva futura</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((b) => {
                const sc = statusColors[b.status] || statusColors.pending;
                const pickup = parseDateOnly(b.pickup_date);
                const returnD = parseDateOnly(b.return_date);
                const days = Math.ceil((returnD.getTime() - pickup.getTime()) / 86400000);
                return (
                  <div key={b.id} className="p-2.5 rounded-lg border border-border/30 bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                        {formatPersonName(b.customer_name)}
                      </span>
                      <Badge variant="outline" className={`${sc.bg} ${sc.text} border-transparent text-[9px] px-1.5 py-0`}>
                        {sc.label}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {pickup.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} →{" "}
                      {returnD.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      <span className="ml-1 text-foreground/60">({days}d)</span>
                    </p>
                    {b.total_price && (
                      <p className="text-[10px] text-primary font-medium mt-0.5">
                        ${b.total_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
