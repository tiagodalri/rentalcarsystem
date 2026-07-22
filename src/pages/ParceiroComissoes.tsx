import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { ArrowLeft, Loader2, TrendingUp, Wallet, Clock, Inbox, Search } from "lucide-react";
import PartnerHeader from "@/components/parceiro/PartnerHeader";
import { supabase } from "@/integrations/supabase/client";
import { parseDateOnly } from "@/lib/dateOnly";
import { Button } from "@/components/ui/button";
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

  if (authorizing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const commissionRows = rows.filter(r => Number(r.commission_amount ?? 0) > 0);

  return (
    <div className="min-h-screen bg-background">
      <PartnerHeader />

      <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
        <div>
          <button onClick={() => navigate("/parceiro")} className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft size={14} /> Voltar ao painel
          </button>
          <h1 className="text-2xl sm:text-3xl font-semibold">Minhas comissões</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Extrato de todas as reservas indicadas pela sua agência.
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <SummaryCard
            icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
            label="Total ganho"
            value={fmtUSD(totals.total)}
            accent="emerald"
            hint={`${totals.count} ${totals.count === 1 ? "reserva" : "reservas"}`}
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

        {/* Table */}
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <div className="px-4 sm:px-6 py-3 border-b border-border/40 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Extrato</h2>
            {!loading && commissionRows.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {commissionRows.length} {commissionRows.length === 1 ? "lançamento" : "lançamentos"}
              </span>
            )}
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
          ) : commissionRows.length === 0 ? (
            <div className="p-10 flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Inbox className="h-7 w-7 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Nenhuma comissão ainda</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Assim que você confirmar sua primeira reserva pela busca, os valores começam a aparecer aqui.
                </p>
              </div>
              <Button onClick={() => navigate("/parceiro/buscar")} className="gold-gradient text-primary-foreground gap-2 mt-2">
                <Search size={14} /> Buscar frota agora
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Reserva</th>
                    <th className="text-left px-4 py-3 font-semibold">Datas</th>
                    <th className="text-left px-4 py-3 font-semibold">Veículo</th>
                    <th className="text-left px-4 py-3 font-semibold">Locadora</th>
                    <th className="text-right px-4 py-3 font-semibold">Total</th>
                    <th className="text-right px-4 py-3 font-semibold">Comissão</th>
                    <th className="text-center px-4 py-3 font-semibold">Repasse</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionRows.map((r) => (
                    <tr key={r.id} className="border-t border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono tabular-nums text-xs">{r.booking_number ?? r.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                        {format(parseDateOnly(r.pickup_date), "dd MMM", { locale: pt })} → {format(parseDateOnly(r.return_date), "dd MMM yy", { locale: pt })}
                      </td>
                      <td className="px-4 py-3 truncate max-w-[220px]">{r.vehicle_id ? (vehicles[r.vehicle_id]?.name ?? "—") : "—"}</td>
                      <td className="px-4 py-3 truncate max-w-[180px] text-muted-foreground">{r.locadora_id ? (locadoras[r.locadora_id]?.name ?? "—") : "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtUSD(r.total_price)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        {r.commission_amount != null ? fmtUSD(r.commission_amount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.commission_payout_status === "paid" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Pago</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">Pendente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
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
