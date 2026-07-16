import { useEffect, useMemo, useState } from "react";
import { parseDateOnly } from "@/lib/dateOnly";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, SlidersHorizontal, Plus, Car, Calendar, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPersonName } from "@/lib/formatName";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { SegmentedControl } from "@/components/mobile/SegmentedControl";
import { useHideFinancials } from "@/hooks/useHideFinancials";

/* ============================================================
   RESERVAS. Mobile-first
   Cards (sem tabela), busca, filtros em bottom sheet, FAB nova reserva.
   ============================================================ */

type Booking = {
  id: string;
  customer_name: string;
  pickup_date: string;
  return_date: string;
  pickup_time: string | null;
  return_time: string | null;
  total_price: number | null;
  status: string;
  vehicle_id: string | null;
  booking_number: string | null;
  vehicle_name?: string;
};

const STATUS: Record<string, { label: string; bar: string; chip: string }> = {
  pending:     { label: "Pendente",     bar: "bg-amber-500",    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  confirmed:   { label: "Confirmada",   bar: "bg-blue-500",     chip: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  active:      { label: "Ativa",        bar: "bg-emerald-500",  chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  in_progress: { label: "Em andamento", bar: "bg-amber-500",    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  completed:   { label: "Concluída",    bar: "bg-muted-foreground/50", chip: "bg-muted text-muted-foreground" },
  cancelled:   { label: "Cancelada",    bar: "bg-red-500",      chip: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

type Range = "upcoming" | "today" | "past" | "all";

export default function MobileBookings() {
  const hideFin = useHideFinancials();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<Range>("upcoming");
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(params.get("status") || "all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("id, customer_name, pickup_date, return_date, pickup_time, return_time, total_price, status, vehicle_id, booking_number")
      .is("deleted_at", null)
      .order("pickup_date", { ascending: false })
      .limit(500);

    const list = (data as Booking[]) || [];
    const vids = Array.from(new Set(list.map((b) => b.vehicle_id).filter(Boolean))) as string[];
    if (vids.length) {
      const { data: vs } = await supabase.rpc("list_vehicles_basic");
      const map = new Map(((vs || []) as { id: string; name: string | null }[]).map((v) => [v.id, v.name || ""]));
      list.forEach((b) => { if (b.vehicle_id) b.vehicle_name = map.get(b.vehicle_id) || ""; });
    }
    setItems(list);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const today = format(new Date(), "yyyy-MM-dd");
  const filtered = useMemo(() => {
    return items.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (range === "today" && b.pickup_date !== today) return false;
      if (range === "upcoming" && b.pickup_date < today) return false;
      if (range === "past" && b.return_date >= today) return false;
      if (search) {
        const q = search.toLowerCase();
        const blob = `${b.customer_name} ${b.vehicle_name || ""} ${b.booking_number || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [items, statusFilter, range, search, today]);

  return (
    <PullToRefresh onRefresh={load}>
      <div className="pb-28">
        {/* Header */}
        <div className="px-4 pt-1">
          <p className="text-xs text-muted-foreground">{filtered.length} de {items.length}</p>


          {/* Search */}
          <div className="mt-3 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, placa, #"
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Range tabs */}
          <div className="mt-3">
            <SegmentedControl
              value={range}
              onChange={(v) => setRange(v as Range)}
              options={[
                { value: "today", label: "Hoje" },
                { value: "upcoming", label: "Próximas" },
                { value: "past", label: "Passadas" },
                { value: "all", label: "Todas" },
              ]}
            />
          </div>

          <button
            onClick={() => setFilterOpen(true)}
            className={`mt-2 w-full h-10 rounded-xl inline-flex items-center justify-center gap-2 text-xs font-medium transition-colors ${
              statusFilter === "all"
                ? "text-muted-foreground hover:text-foreground"
                : "bg-primary/10 text-primary"
            }`}
          >
            <SlidersHorizontal size={13} />
            {statusFilter === "all" ? "Filtros" : `Status: ${STATUS[statusFilter]?.label || statusFilter}`}
            {statusFilter !== "all" && (
              <X
                size={14}
                onClick={(e) => { e.stopPropagation(); setStatusFilter("all"); }}
                className="ml-1 opacity-70 hover:opacity-100"
              />
            )}
          </button>
        </div>

        {/* List */}
        <div className="mt-4 space-y-2 px-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[88px] rounded-xl bg-card border border-border/40 overflow-hidden flex">
                <div className="w-1 bg-muted" />
                <div className="flex-1 p-3.5 space-y-2">
                  <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                  <div className="h-2.5 w-2/3 rounded bg-muted/70 animate-pulse" />
                  <div className="h-2.5 w-1/3 rounded bg-muted/60 animate-pulse" />
                </div>
              </div>
            ))

          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma reserva encontrada.</div>
          ) : filtered.map((b) => {
            const cfg = STATUS[b.status] || STATUS.pending;
            return (
              <button
                key={b.id}
                onClick={() => navigate(`/admin/bookings/${b.id}`)}
                className="w-full text-left bg-card rounded-xl border border-border/50 overflow-hidden active:scale-[0.99] transition-transform"
              >
                <div className="flex">
                  <div className={`w-1 ${cfg.bar}`} />
                  <div className="flex-1 p-3.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <PersonAvatar name={b.customer_name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{formatPersonName(b.customer_name)}</div>
                          <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                            <Car size={11} /> {b.vehicle_name || ""}
                            {b.booking_number && <span className="opacity-60">· #{b.booking_number}</span>}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${cfg.chip}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground inline-flex items-center gap-1.5 tabular-nums">
                        <Calendar size={11} />
                        {format(parseDateOnly(b.pickup_date), "dd MMM", { locale: ptBR })} → {format(parseDateOnly(b.return_date), "dd MMM", { locale: ptBR })}
                      </span>
                      {!hideFin && b.total_price != null && (
                        <span className="text-sm font-semibold tabular-nums">${Math.round(b.total_price).toLocaleString("en-US")}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>


        {/* Filter sheet */}
        <MobileSheet open={filterOpen} onOpenChange={setFilterOpen} title="Filtrar reservas">
          <div className="p-4 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</div>
            {[["all", "Todas"], ...Object.entries(STATUS).map(([k, v]) => [k, v.label] as [string, string])].map(([k, label]) => (
              <button
                key={k}
                onClick={() => { setStatusFilter(k); setFilterOpen(false); }}
                className={`w-full h-12 px-4 rounded-xl flex items-center justify-between text-sm ${statusFilter === k ? "bg-primary/10 text-primary font-medium" : "bg-muted/40"}`}
              >
                <span>{label}</span>
                {statusFilter === k && <span className="text-primary">✓</span>}
              </button>
            ))}
          </div>
        </MobileSheet>
      </div>
    </PullToRefresh>
  );
}
