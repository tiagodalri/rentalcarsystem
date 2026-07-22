import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Loader2, Wallet, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { parseDateOnly } from "@/lib/dateOnly";

type Row = {
  id: string;
  booking_number: string | null;
  pickup_date: string;
  return_date: string;
  total_price: number | null;
  commission_amount: number | null;
  commission_payout_status: string;
  partner_id: string;
  locadora_id: string | null;
  vehicle_id: string | null;
};

export function PartnerPayoutsTab() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [partners, setPartners] = useState<Record<string, { name: string }>>({});
  const [vehicles, setVehicles] = useState<Record<string, { name: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, booking_number, pickup_date, return_date, total_price, commission_amount, commission_payout_status, partner_id, locadora_id, vehicle_id")
        .not("partner_id", "is", null)
        .order("pickup_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      const list = (data ?? []) as Row[];
      setRows(list);

      const pIds = Array.from(new Set(list.map(r => r.partner_id).filter(Boolean)));
      const vIds = Array.from(new Set(list.map(r => r.vehicle_id).filter(Boolean))) as string[];

      if (pIds.length) {
        const { data: ps } = await supabase.from("partners_public").select("id, name").in("id", pIds);
        const map: Record<string, { name: string }> = {};
        (ps ?? []).forEach((p: any) => { map[p.id] = { name: p.name }; });
        setPartners(map);
      }
      if (vIds.length) {
        const { data: vs } = await supabase.from("vehicles").select("id, name").in("id", vIds);
        const map: Record<string, { name: string }> = {};
        (vs ?? []).forEach((v: any) => { map[v.id] = { name: v.name }; });
        setVehicles(map);
      }
    } catch (e) {
      toast({ title: "Erro ao carregar repasses", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    let paid = 0, pending = 0;
    for (const r of rows) {
      const amt = Number(r.commission_amount ?? 0);
      if (!amt) continue;
      if (r.commission_payout_status === "paid") paid += amt; else pending += amt;
    }
    return { paid, pending };
  }, [rows]);

  const togglePayout = async (r: Row) => {
    const newStatus = r.commission_payout_status === "paid" ? "pending" : "paid";
    setSavingId(r.id);
    try {
      const { data, error } = await supabase.functions.invoke("mark-commission-paid", {
        body: { booking_id: r.id, status: newStatus },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao atualizar");
      setRows((prev) => prev.map(x => x.id === r.id ? { ...x, commission_payout_status: newStatus } : x));
      toast({ title: newStatus === "paid" ? "Repasse marcado como pago" : "Repasse revertido para pendente" });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-amber-600/5 p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Pendente de repasse</p>
          <p className="text-2xl font-bold tabular-nums mt-1">US$ {totals.pending.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-emerald-600/5 p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Já repassado</p>
          <p className="text-2xl font-bold tabular-nums mt-1">US$ {totals.paid.toFixed(2)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Repasses a parceiros</h3>
        </div>
        {loading ? (
          <div className="p-10 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma reserva indicada por parceiros ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Reserva</th>
                  <th className="text-left px-4 py-3 font-semibold">Datas</th>
                  <th className="text-left px-4 py-3 font-semibold">Parceiro</th>
                  <th className="text-left px-4 py-3 font-semibold">Veículo</th>
                  <th className="text-right px-4 py-3 font-semibold">Total</th>
                  <th className="text-right px-4 py-3 font-semibold">Comissão</th>
                  <th className="text-center px-4 py-3 font-semibold">Repasse</th>
                  <th className="text-right px-4 py-3 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/30 hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono tabular-nums text-xs">{r.booking_number ?? r.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {format(parseDateOnly(r.pickup_date), "dd MMM", { locale: pt })} → {format(parseDateOnly(r.return_date), "dd MMM yy", { locale: pt })}
                    </td>
                    <td className="px-4 py-3">{partners[r.partner_id]?.name ?? "—"}</td>
                    <td className="px-4 py-3 truncate max-w-[220px]">{r.vehicle_id ? (vehicles[r.vehicle_id]?.name ?? "—") : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">US$ {Number(r.total_price ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {r.commission_amount != null ? `US$ ${Number(r.commission_amount).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.commission_payout_status === "paid" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Pago</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">Pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={r.commission_payout_status === "paid" ? "outline" : "default"}
                        onClick={() => togglePayout(r)}
                        disabled={savingId === r.id || r.commission_amount == null}
                      >
                        {savingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {r.commission_payout_status === "paid" ? "Reverter" : "Marcar pago"}
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
