import { formatPersonName } from "@/lib/formatName";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { CalendarCheck, CalendarX2, Wrench, Car, Clock, MapPin, Phone, MessageCircle, ArrowRight, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { buildWhatsAppUrl, defaultClientMessage } from "@/lib/whatsapp";

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

  const todayLabel = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const Section = ({ title, icon: Icon, count, color, children }: any) => (
    <Card className="bg-card/80 border-border/30 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon size={15} className={color} />
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold tabular-nums ${color} bg-current/10`}>
          {count}
        </span>
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  );

  const BookingItem = ({ b, type }: { b: BookingRow; type: "pickup" | "return" }) => {
    const veh = vehicles[b.vehicle_id];
    const time = type === "pickup" ? b.pickup_time : b.return_time;
    const loc = type === "pickup" ? b.pickup_location : b.return_location;
    const wa = buildWhatsAppUrl(b.customer_phone, defaultClientMessage(b.customer_name));
    return (
      <div
        onClick={() => navigate(`/admin/bookings/${b.id}`)}
        className="px-4 py-3 border-b border-border/10 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-foreground tabular-nums shrink-0">
              {time || "—"}
            </span>
            <span className="text-[10px] text-muted-foreground/60">•</span>
            <span className="text-xs text-foreground font-medium truncate">{formatPersonName(b.customer_name)}</span>
          </div>
          {b.booking_number && (
            <span className="text-[9px] font-mono text-muted-foreground shrink-0">{b.booking_number}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-1">
          <span className="flex items-center gap-1 min-w-0">
            <Car size={10} className="shrink-0" />
            <span className="truncate">{veh?.name || "—"}</span>
          </span>
          {loc && (
            <span className="flex items-center gap-1 min-w-0">
              <MapPin size={10} className="shrink-0" />
              <span className="truncate">{loc}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-2 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {b.customer_phone && (
            <a
              href={`tel:${b.customer_phone}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[10px] text-foreground hover:bg-muted/80"
            >
              <Phone size={9} /> Ligar
            </a>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 text-[10px] hover:bg-emerald-500/25"
            >
              <MessageCircle size={9} /> WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Carregando operação do dia...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-2">
            <Sparkles size={11} /> Operação do Dia
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight capitalize">{todayLabel}</h1>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/30 bg-card/80 p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Retiradas</p>
          <p className="text-3xl font-bold text-emerald-500 tabular-nums mt-1">{pickups.length}</p>
        </div>
        <div className="rounded-xl border border-border/30 bg-card/80 p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Devoluções</p>
          <p className="text-3xl font-bold text-amber-500 tabular-nums mt-1">{returns.length}</p>
        </div>
        <div className="rounded-xl border border-border/30 bg-card/80 p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Em Preparação</p>
          <p className="text-3xl font-bold text-blue-500 tabular-nums mt-1">{maintenance.length}</p>
        </div>
      </div>

      {/* 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Retiradas hoje" icon={CalendarCheck} count={pickups.length} color="text-emerald-500">
          {pickups.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma retirada hoje.</div>
          ) : (
            pickups.map(b => <BookingItem key={b.id} b={b} type="pickup" />)
          )}
        </Section>

        <Section title="Devoluções hoje" icon={CalendarX2} count={returns.length} color="text-amber-500">
          {returns.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma devolução hoje.</div>
          ) : (
            returns.map(b => <BookingItem key={b.id} b={b} type="return" />)
          )}
        </Section>

        <Section title="Carros em preparação" icon={Wrench} count={maintenance.length} color="text-blue-500">
          {maintenance.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Nenhum carro em preparação.</div>
          ) : (
            maintenance.map(v => (
              <div
                key={v.id}
                onClick={() => navigate(`/admin/fleet/${v.id}`)}
                className="px-4 py-3 border-b border-border/10 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Car size={13} className="text-blue-500" />
                  <span className="text-sm text-foreground font-medium">{v.name}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-semibold uppercase tracking-wider">
                  {v.status === "maintenance" ? "Manutenção" : "Preparando"}
                </span>
              </div>
            ))
          )}
        </Section>
      </div>
    </div>
  );
}
