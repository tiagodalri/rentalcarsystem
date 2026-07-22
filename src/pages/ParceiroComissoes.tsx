import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { ArrowLeft, Loader2, TrendingUp, Wallet, Clock, Inbox, Search, X, ExternalLink, Calendar, User, Car, Building2, Receipt, ChevronRight } from "lucide-react";
import PartnerHeader from "@/components/parceiro/PartnerHeader";
import { supabase } from "@/integrations/supabase/client";
import { parseDateOnly } from "@/lib/dateOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatPersonName } from "@/lib/formatName";
import { fmtUSD } from "@/lib/partnerFormat";

type Row = {
  id: string;
  booking_number: string | null;
  pickup_date: string;
  return_date: string;
  total_price: number | null;
  commission_amount: number | null;
  commission_type: string | null;
  commission_value: number | null;
  commission_payout_status: string;
  status: string;
  customer_name: string | null;
  vehicle_name: string | null;
  vehicle_category: string | null;
  locadora_name: string | null;
};

export default function ParceiroComissoes() {
  const navigate = useNavigate();
  const [authorizing, setAuthorizing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Row | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/parceiro/login", { replace: true }); return; }
      const { data: role } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", session.user.id).eq("role", "partner").maybeSingle();
      if (!role) { navigate("/parceiro/login", { replace: true }); return; }
      setAuthorizing(false);
      await loadData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("partner-booking-history", { body: {} });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = data as any;
      if (!res?.ok) throw new Error(res?.error || "Falha ao carregar histórico");
      setRows((res.results ?? []) as Row[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };


  const totals = useMemo(() => {
    let total = 0, paid = 0, pending = 0, count = 0;
    for (const r of rows) {
      const amt = Number(r.commission_amount ?? 0);
      if (!amt) continue;
      count += 1;
      total += amt;
      if (r.commission_payout_status === "paid") paid += amt; else pending += amt;
    }
    return { total, paid, pending, count };
  }, [rows]);

  const statusOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.status) s.add(r.status);
    return Array.from(s).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        r.booking_number ?? "",
        r.customer_name ?? "",
        r.vehicle_name ?? "",
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, statusFilter]);

  if (authorizing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PartnerHeader />

      <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
        <div>
          <button onClick={() => navigate("/parceiro")} className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft size={14} /> Voltar ao painel
          </button>
          <h1 className="text-2xl sm:text-3xl font-semibold">Minhas reservas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todas as reservas indicadas pela sua agência, com resumo financeiro de comissão.
          </p>
        </div>

        {/* Summary */}
        <section className="space-y-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Resumo de comissão</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <SummaryCard
              icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
              label="Total ganho"
              value={fmtUSD(totals.total)}
              accent="emerald"
              hint={`${totals.count} ${totals.count === 1 ? "reserva com comissão" : "reservas com comissão"}`}
              loading={loading}
            />
            <SummaryCard
              icon={<Clock className="h-5 w-5 text-amber-500" />}
              label="Aguardando repasse"
              value={fmtUSD(totals.pending)}
              accent="amber"
              loading={loading}
            />
            <SummaryCard
              icon={<Wallet className="h-5 w-5 text-primary" />}
              label="Já recebido"
              value={fmtUSD(totals.paid)}
              accent="primary"
              loading={loading}
            />
          </div>
        </section>

        {/* Table */}
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <div className="px-4 sm:px-6 py-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Histórico completo</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Reserva, cliente ou veículo"
                  className="pl-8 pr-8 h-9 text-xs w-full sm:w-64"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs uppercase tracking-wider"
              >
                <option value="all">Todos os status</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {!loading && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {filteredRows.length} {filteredRows.length === 1 ? "reserva" : "reservas"}
                </span>
              )}
            </div>
          </div>
          {loading ? (
            <div className="divide-y divide-border/30">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 sm:px-6 py-4 flex items-center gap-4 animate-pulse">
                  <div className="h-3 w-20 bg-muted/60 rounded" />
                  <div className="h-3 w-28 bg-muted/50 rounded" />
                  <div className="h-3 flex-1 bg-muted/40 rounded" />
                  <div className="h-3 w-20 bg-muted/60 rounded" />
                  <div className="h-5 w-16 bg-muted/60 rounded-full" />
                </div>
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-10 flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Inbox className="h-7 w-7 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold">
                  {rows.length === 0 ? "Nenhuma reserva ainda" : "Nenhuma reserva encontrada"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  {rows.length === 0
                    ? "Assim que você confirmar sua primeira reserva pela busca, ela aparecerá aqui."
                    : "Ajuste a busca ou o filtro de status para encontrar suas reservas."}
                </p>
              </div>
              {rows.length === 0 && (
                <Button onClick={() => navigate("/parceiro/buscar")} className="gold-gradient text-primary-foreground gap-2 mt-2">
                  <Search size={14} /> Buscar frota agora
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Reserva</th>
                    <th className="text-left px-4 py-3 font-semibold">Datas</th>
                    <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold">Veículo</th>
                    <th className="text-left px-4 py-3 font-semibold">Locadora</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-4 py-3 font-semibold">Total</th>
                    <th className="text-right px-4 py-3 font-semibold">Comissão</th>
                    <th className="text-center px-4 py-3 font-semibold">Repasse</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const hasCommission = r.commission_amount != null && Number(r.commission_amount) > 0;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className="border-t border-border/30 hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4 font-mono tabular-nums text-xs whitespace-nowrap align-middle">{r.booking_number ?? r.id.slice(0, 8)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-muted-foreground tabular-nums align-middle">
                          {format(parseDateOnly(r.pickup_date), "dd MMM", { locale: pt })} → {format(parseDateOnly(r.return_date), "dd MMM yy", { locale: pt })}
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="truncate max-w-[180px]">{r.customer_name ? formatPersonName(r.customer_name) : "—"}</div>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="truncate max-w-[220px]">{r.vehicle_name ?? "—"}</div>
                        </td>
                        <td className="px-4 py-4 align-middle text-muted-foreground">
                          <div className="truncate max-w-[160px]">{r.locadora_name ?? "—"}</div>
                        </td>
                        <td className="px-4 py-4 text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap align-middle">{r.status}</td>
                        <td className="px-4 py-4 text-right tabular-nums whitespace-nowrap align-middle">{fmtUSD(r.total_price)}</td>
                        <td className="px-4 py-4 text-right tabular-nums whitespace-nowrap font-semibold text-emerald-600 dark:text-emerald-400 align-middle">
                          {hasCommission ? fmtUSD(r.commission_amount) : <span className="text-muted-foreground font-normal">—</span>}
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap align-middle">
                          {hasCommission ? (
                            r.commission_payout_status === "paid" ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Pago</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 whitespace-nowrap">Pendente</span>
                            )
                          ) : (
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-4 text-right align-middle">
                          <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <BookingDetailDialog row={selected} onClose={() => setSelected(null)} onOpenFull={(id) => navigate(`/admin/bookings/${id}`)} />
    </div>
  );
}

function BookingDetailDialog({ row, onClose, onOpenFull }: { row: Row | null; onClose: () => void; onOpenFull: (id: string) => void }) {
  const open = !!row;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono text-sm tabular-nums text-muted-foreground">{row.booking_number ?? row.id.slice(0, 8)}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-muted text-muted-foreground whitespace-nowrap">{row.status}</span>
              </DialogTitle>
              <DialogDescription>Resumo da reserva indicada pela sua agência.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <DetailLine icon={<User className="h-4 w-4" />} label="Cliente" value={row.customer_name ? formatPersonName(row.customer_name) : "—"} />
              <DetailLine icon={<Car className="h-4 w-4" />} label="Veículo" value={row.vehicle_name ?? "—"} sub={row.vehicle_category ?? undefined} />
              <DetailLine icon={<Building2 className="h-4 w-4" />} label="Locadora" value={row.locadora_name ?? "—"} />
              <DetailLine
                icon={<Calendar className="h-4 w-4" />}
                label="Período"
                value={`${format(parseDateOnly(row.pickup_date), "dd MMM yy", { locale: pt })} → ${format(parseDateOnly(row.return_date), "dd MMM yy", { locale: pt })}`}
              />

              <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground inline-flex items-center gap-2"><Receipt className="h-4 w-4" /> Total da reserva</span>
                  <span className="tabular-nums font-medium">{fmtUSD(row.total_price)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sua comissão</span>
                  <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                    {row.commission_amount != null && Number(row.commission_amount) > 0 ? fmtUSD(row.commission_amount) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                  <span className="text-muted-foreground uppercase tracking-wider">Status de repasse</span>
                  {row.commission_payout_status === "paid" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Pago</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">Pendente</span>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
              <Button onClick={() => onOpenFull(row.id)} className="gold-gradient text-primary-foreground gap-2">
                Ver reserva completa <ExternalLink className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailLine({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
        {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, hint, accent, loading }: {
  icon: React.ReactNode; label: string; value: string; hint?: string;
  accent: "emerald" | "amber" | "primary"; loading?: boolean;
}) {
  const border = accent === "emerald" ? "border-emerald-500/40" : accent === "amber" ? "border-amber-500/40" : "border-primary/40";
  const bg = accent === "emerald"
    ? "bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-emerald-600/5"
    : accent === "amber"
      ? "bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-amber-600/5"
      : "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent";
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4 sm:p-5`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{label}</span>
      </div>
      {loading ? (
        <div className="mt-2.5 h-7 w-32 bg-muted/50 rounded animate-pulse" />
      ) : (
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      )}
      {hint && !loading && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
