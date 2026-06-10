import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarCheck, CalendarX2, Wrench, ChevronLeft, ChevronRight,
  CalendarDays, Phone, MessageCircle, ClipboardCheck, Car,
} from "lucide-react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPersonName } from "@/lib/formatName";
import { SegmentedControl } from "@/components/mobile/SegmentedControl";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { MobileList, MobileListItem } from "@/components/mobile/MobileListItem";
import { SwipeAction } from "@/components/mobile/SwipeAction";

/* ============================================================
   OPERAÇÃO — Mobile-first
   Segmented control: Retiradas / Devoluções / Em preparo.
   Cards grandes (sem tabela), swipe-actions (ligar, WhatsApp).
   ============================================================ */

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  pickup_date: string;
  return_date: string;
  pickup_time: string | null;
  return_time: string | null;
  vehicle_id: string;
  status: string;
  booking_number: string | null;
};
type Vehicle = { id: string; name: string; status: string };

type Tab = "pickups" | "returns" | "prep";

const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
const callHref = (p: string | null) => (p ? `tel:${onlyDigits(p)}` : undefined);
const waHref = (p: string | null) => (p ? `https://wa.me/${onlyDigits(p)}` : undefined);

export default function MobileOps() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [tab, setTab] = useState<Tab>("pickups");
  const [pickups, setPickups] = useState<Booking[]>([]);
  const [returns, setReturns] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [prep, setPrep] = useState<Vehicle[]>([]);

  const load = async () => {
    setLoading(true);
    const dayStr = format(date, "yyyy-MM-dd");
    const [pk, rt, vs] = await Promise.all([
      supabase.from("bookings")
        .select("id, customer_name, customer_phone, pickup_date, return_date, pickup_time, return_time, vehicle_id, status, booking_number")
        .eq("pickup_date", dayStr)
        .in("status", ["pending", "confirmed", "active", "in_progress", "completed"])
        .order("pickup_time"),
      supabase.from("bookings")
        .select("id, customer_name, customer_phone, pickup_date, return_date, pickup_time, return_time, vehicle_id, status, booking_number")
        .eq("return_date", dayStr)
        .in("status", ["confirmed", "active", "in_progress", "completed"])
        .order("return_time"),
      supabase.from("vehicles").select("id, name, status"),
    ]);
    const map: Record<string, Vehicle> = {};
    (vs.data || []).forEach((v: any) => { map[v.id] = v; });
    setVehicles(map);
    setPickups((pk.data as Booking[]) || []);
    setReturns((rt.data as Booking[]) || []);
    setPrep(((vs.data as Vehicle[]) || []).filter((v) => ["maintenance", "preparing"].includes(v.status)));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [date]);

  const isToday = isSameDay(date, new Date());
  const list: Booking[] = tab === "pickups" ? pickups : tab === "returns" ? returns : [];

  const counts = useMemo(() => ({
    pickups: pickups.length, returns: returns.length, prep: prep.length,
  }), [pickups, returns, prep]);

  const renderItem = (b: Booking, kind: "in" | "out") => {
    const v = vehicles[b.vehicle_id];
    const time = (kind === "in" ? b.pickup_time : b.return_time)?.slice(0, 5) || "—:—";
    const actions = [];
    if (b.customer_phone) {
      actions.push({
        label: "Ligar",
        color: "bg-emerald-500",
        icon: <Phone size={18} />,
        onClick: () => { window.location.href = callHref(b.customer_phone)!; },
      });
      actions.push({
        label: "WhatsApp",
        color: "bg-[#25D366]",
        icon: <MessageCircle size={18} />,
        onClick: () => { window.open(waHref(b.customer_phone)!, "_blank"); },
      });
    }
    return (
      <SwipeAction key={b.id} rightActions={actions}>
        <button
          onClick={() => navigate(`/admin/bookings/${b.id}`)}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-card hover:bg-muted/40 active:bg-muted/60 transition-colors text-left"
        >
          <div className="flex flex-col items-center justify-center w-14 shrink-0">
            <span className="text-lg font-semibold tabular-nums leading-none">{time}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              {kind === "in" ? "retira" : "devolve"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{formatPersonName(b.customer_name)}</div>
            <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
              <Car size={11} />
              {v?.name || "Veículo —"}
              {b.booking_number && <span className="opacity-60">· #{b.booking_number}</span>}
            </div>
          </div>
          {kind === "in" && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/admin/inspections/new?booking=${b.id}`); }}
              className="shrink-0 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center gap-1.5"
            >
              <ClipboardCheck size={13} /> Inspeção
            </button>
          )}
        </button>
      </SwipeAction>
    );
  };

  return (
    <PullToRefresh onRefresh={load}>
      <div className="pb-24 space-y-4">
        {/* Header */}
        <div className="px-4 pt-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 font-medium">
            Operação · {isToday ? "hoje" : "outro dia"}
          </div>
          <h1 className="admin-h1 text-2xl mt-1 capitalize">
            {format(date, "EEEE, dd 'de' MMM", { locale: ptBR })}
          </h1>

          <div className="mt-3 inline-flex items-center gap-1 rounded-xl border border-border/50 bg-card p-1">
            <button onClick={() => setDate((d) => addDays(d, -1))} className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground active:bg-muted">
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setDate(startOfDay(new Date()))}
              disabled={isToday}
              className={`h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${isToday ? "bg-muted text-muted-foreground" : "text-foreground active:bg-muted"}`}
            >
              <CalendarDays size={13} /> {isToday ? "Hoje" : "Voltar para hoje"}
            </button>
            <button onClick={() => setDate((d) => addDays(d, 1))} className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground active:bg-muted">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4">
          <SegmentedControl
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={[
              { value: "pickups", label: "Retiradas", icon: <CalendarCheck size={13} />, badge: counts.pickups },
              { value: "returns", label: "Devoluções", icon: <CalendarX2 size={13} />, badge: counts.returns },
              { value: "prep", label: "Em preparo", icon: <Wrench size={13} />, badge: counts.prep },
            ]}
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : tab === "prep" ? (
          <MobileList>
            {prep.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum veículo em preparação.</div>
            ) : prep.map((v) => (
              <MobileListItem
                key={v.id}
                title={v.name}
                subtitle={v.status === "maintenance" ? "Em manutenção" : "Em preparação"}
                leading={<Wrench size={18} className="text-sky-500" />}
                onClick={() => navigate(`/admin/fleet/${v.id}`)}
              />
            ))}
          </MobileList>
        ) : (
          <MobileList>
            {list.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhuma {tab === "pickups" ? "retirada" : "devolução"} neste dia.
              </div>
            ) : list.map((b) => renderItem(b, tab === "pickups" ? "in" : "out"))}
          </MobileList>
        )}
      </div>
    </PullToRefresh>
  );
}
