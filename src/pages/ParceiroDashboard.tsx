import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, ArrowRight, Wallet, TrendingUp, Clock, Sparkles } from "lucide-react";
import PartnerHeader from "@/components/parceiro/PartnerHeader";
import { Button } from "@/components/ui/button";
import { fmtUSD } from "@/lib/partnerFormat";

type CommRow = { commission_amount: number | null; commission_payout_status: string };

export default function ParceiroDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<CommRow[]>([]);
  const [loadingComm, setLoadingComm] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/parceiro/login", { replace: true }); return; }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "partner")
        .maybeSingle();
      if (!role) { navigate("/parceiro/login", { replace: true }); return; }
      setEmail(session.user.email ?? null);
      setLoading(false);

      const { data: bookings } = await supabase
        .from("bookings")
        .select("commission_amount, commission_payout_status")
        .limit(500);
      setRows((bookings ?? []) as CommRow[]);
      setLoadingComm(false);
    })();
  }, [navigate]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PartnerHeader email={email} />

      <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6 sm:space-y-8">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">Bem-vindo</p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Painel do parceiro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comissões, disponibilidade em tempo real e reservas — tudo em um só lugar.
          </p>
        </div>

        {/* Commission teaser */}
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-emerald-600/5 p-5 sm:p-7 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400 font-semibold">
                  <TrendingUp size={13} /> Total ganho
                </div>
                <p className="mt-1.5 text-3xl sm:text-4xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300 leading-none">
                  {loadingComm ? <span className="inline-block h-8 w-40 rounded-md bg-emerald-500/20 animate-pulse" /> : fmtUSD(totals.total)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Clock size={12} /> Pendente <strong className="tabular-nums">{fmtUSD(totals.pending)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <Wallet size={12} /> Recebido <strong className="tabular-nums">{fmtUSD(totals.paid)}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    {totals.count} {totals.count === 1 ? "reserva indicada" : "reservas indicadas"}
                  </span>
                </div>
              </div>
              <Button
                onClick={() => navigate("/parceiro/comissoes")}
                variant="outline"
                className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold uppercase tracking-wider text-xs gap-2 shrink-0 self-start sm:self-auto"
              >
                Ver extrato <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
          <button
            onClick={() => navigate("/parceiro/buscar")}
            className="group text-left rounded-2xl border border-border/40 bg-card p-6 flex flex-col gap-4 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Buscar frota disponível</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Disponibilidade em tempo real em todas as locadoras da rede.
              </p>
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-primary font-semibold inline-flex items-center gap-1.5">
              <Sparkles size={11} /> Comece uma nova reserva
            </div>
          </button>

          <button
            onClick={() => navigate("/parceiro/comissoes")}
            className="group text-left rounded-2xl border border-border/40 bg-card p-6 flex flex-col gap-4 hover:border-emerald-500/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/15 transition-colors">
                <Wallet className="h-5 w-5 text-emerald-500" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Minhas comissões</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Extrato completo com valores pendentes e já repassados.
              </p>
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1.5">
              <TrendingUp size={11} /> Acompanhe seus ganhos
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
