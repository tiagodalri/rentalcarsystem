import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin, Phone, User, DollarSign, Hash } from "lucide-react";
import { formatPersonName } from "@/lib/formatName";

export type BookingLike = {
  id: string;
  vehicle_id: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  pickup_date: string;
  return_date: string;
  pickup_time?: string | null;
  return_time?: string | null;
  pickup_location?: string | null;
  return_location?: string | null;
  status: string;
  booking_number: string | null;
  total_price?: number | null;
};

export const STATUS_TOKEN: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  pending: {
    bg: "bg-amber-500/15 hover:bg-amber-500/25",
    border: "border-amber-500/50",
    dot: "bg-amber-500",
    label: "Pendente",
  },
  confirmed: {
    bg: "bg-sky-500/15 hover:bg-sky-500/25",
    border: "border-sky-500/50",
    dot: "bg-sky-500",
    label: "Confirmada",
  },
  active: {
    bg: "bg-emerald-500/15 hover:bg-emerald-500/25",
    border: "border-emerald-500/50",
    dot: "bg-emerald-500",
    label: "Ativa",
  },
  in_progress: {
    bg: "bg-emerald-500/15 hover:bg-emerald-500/25",
    border: "border-emerald-500/50",
    dot: "bg-emerald-500",
    label: "Em andamento",
  },
  completed: {
    bg: "bg-zinc-500/15 hover:bg-zinc-500/25",
    border: "border-zinc-500/50",
    dot: "bg-zinc-500",
    label: "Concluída",
  },
  cancelled: {
    bg: "bg-red-500/10 hover:bg-red-500/20",
    border: "border-red-500/40",
    dot: "bg-red-500",
    label: "Cancelada",
  },
};

type Props = {
  booking: BookingLike;
  left: number;
  width: number;
  height: number;
};

export function BookingBar({ booking, left, width, height }: Props) {
  const navigate = useNavigate();
  const token = STATUS_TOKEN[booking.status] || STATUS_TOKEN.confirmed;
  const days = differenceInCalendarDays(parseISO(booking.return_date), parseISO(booking.pickup_date)) + 1;
  const isNarrow = width < 80;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          style={{ left: left + 2, width, top: 4, height }}
          className={`absolute rounded-md border ${token.bg} ${token.border} text-left transition-all hover:z-30 hover:shadow-lg overflow-hidden group`}
        >
          <div className="flex items-center h-full gap-1.5 px-2">
            <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${token.dot}`} />
            {!isNarrow && (
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-foreground truncate leading-tight">
                  {formatPersonName(booking.customer_name)}
                </div>
                <div className="text-[9px] text-muted-foreground truncate tabular-nums leading-tight">
                  {booking.booking_number || ""} • {days}d
                </div>
              </div>
            )}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-0 bg-popover">
        <div className="p-3 border-b border-border/40 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${token.dot}`} />
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {token.label}
              </Badge>
            </div>
            <div className="mt-1.5 text-sm font-medium text-foreground truncate">{formatPersonName(booking.customer_name)}</div>
            <div className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-1 mt-0.5">
              <Hash size={10} /> {booking.booking_number || "sem número"}
            </div>
          </div>
        </div>
        <div className="p-3 space-y-2 text-[12px]">
          <Row icon={<CalendarDays size={12} />} label="Retirada">
            <span className="tabular-nums">
              {format(parseISO(booking.pickup_date), "dd MMM yyyy", { locale: ptBR })}
              {booking.pickup_time ? ` • ${booking.pickup_time.slice(0, 5)}` : ""}
            </span>
          </Row>
          <Row icon={<CalendarDays size={12} />} label="Devolução">
            <span className="tabular-nums">
              {format(parseISO(booking.return_date), "dd MMM yyyy", { locale: ptBR })}
              {booking.return_time ? ` • ${booking.return_time.slice(0, 5)}` : ""}
            </span>
          </Row>
          <Row icon={<Clock size={12} />} label="Duração">
            <span className="tabular-nums">{days} {days === 1 ? "diária" : "diárias"}</span>
          </Row>
          {booking.pickup_location && (
            <Row icon={<MapPin size={12} />} label="Local retirada">
              <span className="block break-words leading-snug">{booking.pickup_location}</span>
            </Row>
          )}
          {booking.customer_phone && (
            <Row icon={<Phone size={12} />} label="Telefone">
              <span className="tabular-nums">{booking.customer_phone}</span>
            </Row>
          )}
          {booking.total_price != null && (
            <Row icon={<DollarSign size={12} />} label="Total">
              <span className="tabular-nums font-semibold text-foreground">
                ${Number(booking.total_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </Row>
          )}
        </div>
        <div className="p-3 border-t border-border/40 flex gap-2">
          <button
            onClick={() => navigate(`/admin/bookings/${booking.id}`)}
            className="flex-1 h-8 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
          >
            <User size={12} /> Abrir reserva
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="flex-1 min-w-0 text-foreground break-words">{children}</span>
    </div>
  );
}
