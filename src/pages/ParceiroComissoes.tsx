import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { ArrowLeft, Handshake, Loader2, LogOut, TrendingUp, Wallet, Clock } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { parseDateOnly } from "@/lib/dateOnly";

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
  locadora_id: string | null;
  vehicle_id: string | null;
};

type VehicleMap = Record<string, { name: string }>;
type LocadoraMap = Record<string, { name: string }>;

export default function ParceiroComissoes() {
  const navigate = useNavigate();
  const [authorizing, setAuthorizing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [vehicles, setVehicles] = useState<VehicleMap>({});
  const [locadoras, setLocadoras] = useState<LocadoraMap>({});

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
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("id, booking_number, pickup_date, return_date, total_price, commission_amount, commission_type, commission_value, commission_payout_status, status, locadora_id, vehicle_id")
        .order("pickup_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      const list = (bookings ?? []) as Row[];
      setRows(list);

      const vIds = Array.from(new Set(list.map(r => r.vehicle_id).filter(Boolean))) as string[];
      const lIds = Array.from(new Set(list.map(r => r.locadora_id).filter(Boolean))) as string[];

      if (vIds.length) {
        const { data: vs } = await supabase.from("vehicles").select("id, name").in("id", vIds);
        const map: VehicleMap = {};
        (vs ?? []).forEach((v: any) => { map[v.id] = { name: v.name }; });
        setVehicles(map);
      }
      if (lIds.length) {
        const { data: ls } = await supabase.from("locadoras").select("id, name").in("id", lIds);
        const map: LocadoraMap = {};
        (ls ?? []).forEach((l: any) => { map[l.id] = { name: l.name }; });
        setLocadoras(map);
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/parceiro/login", { replace: true });
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo className="h-7 shrink-0" />
          <span className="hidden sm:inline text-xs uppercase tracking-[0.22em] text-muted-foreground items-center gap-1.5">
            <Handshake size={13} className="text-primary inline mr-1" /> Parceiro
          </span>
        </div>
        <button onClick={signOut} className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <LogOut size={14} /> Sair
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
        <div>
          <button onClick={() => navigate("/parceiro")} className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft size={14} /> Voltar ao painel
          </button>
          <h1 className="text-2xl sm:text-3xl font-semibold">Minhas comissões</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Extrato de todas as reservas indicadas pela sua agência.
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
            label="Total ganho"
            value={`US$ ${totals.total.toFixed(2)}`}
            accent="emerald"
            hint={`${totals.count} ${totals.count === 1 ? "reserva" : "reservas"}`}
          />
          <SummaryCard
            icon={<Clock className="h-5 w-5 text-amber-500" />}
            label="Aguardando repasse"
            value={`US$ ${totals.pending.toFixed(2)}`}
            accent="amber"
          />
          <SummaryCard
            icon={<Wallet className="h-5 w-5 text-primary" />}
            label="Já recebido"
            value={`US$ ${totals.paid.toFixed(2)}`}
            accent="primary"
          />
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <div className="px-4 sm:px-6 py-3 border-b border-border/40">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Extrato</h2>
          </div>
          {loading ? (
            <div className="p-10 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma reserva indicada ainda. Comece pela busca de frota.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
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
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/30 hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono tabular-nums text-xs">{r.booking_number ?? r.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {format(parseDateOnly(r.pickup_date), "dd MMM", { locale: pt })} → {format(parseDateOnly(r.return_date), "dd MMM yy", { locale: pt })}
                      </td>
                      <td className="px-4 py-3 truncate max-w-[220px]">{r.vehicle_id ? (vehicles[r.vehicle_id]?.name ?? "—") : "—"}</td>
                      <td className="px-4 py-3 truncate max-w-[180px] text-muted-foreground">{r.locadora_id ? (locadoras[r.locadora_id]?.name ?? "—") : "—"}</td>
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

function SummaryCard({ icon, label, value, hint, accent }: { icon: React.ReactNode; label: string; value: string; hint?: string; accent: "emerald" | "amber" | "primary" }) {
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
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
