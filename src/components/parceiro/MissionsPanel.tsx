import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Target, Check, Clock, Wallet, Sparkles, Loader2 } from "lucide-react";
import { fmtUSD } from "@/lib/partnerFormat";

interface Tier {
  id: string;
  threshold_bookings: number;
  bonus_amount: number;
  label: string;
  sort_order: number;
}

interface Award {
  id: string;
  tier_id: string;
  earned_at: string;
  payout_status: "pending" | "paid";
  paid_at: string | null;
}

const CONFIRMED = ["confirmed", "active", "in_progress", "completed"];

export default function MissionsPanel() {
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [confirmedCount, setConfirmedCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [tRes, aRes, bRes] = await Promise.all([
        supabase
          .from("partner_bonus_tiers")
          .select("id, threshold_bookings, bonus_amount, label, sort_order")
          .eq("is_active", true)
          .order("threshold_bookings", { ascending: true }),
        supabase
          .from("partner_bonus_awards")
          .select("id, tier_id, earned_at, payout_status, paid_at"),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .in("status", CONFIRMED)
          .is("deleted_at", null),
      ]);
      setTiers((tRes.data ?? []) as Tier[]);
      setAwards((aRes.data ?? []) as Award[]);
      setConfirmedCount(bRes.count ?? 0);
      setLoading(false);
    })();
  }, []);

  const awardedIds = useMemo(() => new Set(awards.map((a) => a.tier_id)), [awards]);
  const awardByTier = useMemo(() => {
    const m: Record<string, Award> = {};
    for (const a of awards) m[a.tier_id] = a;
    return m;
  }, [awards]);

  const nextTier = useMemo(
    () => tiers.find((t) => !awardedIds.has(t.id) && t.threshold_bookings > confirmedCount) ||
          tiers.find((t) => !awardedIds.has(t.id)),
    [tiers, awardedIds, confirmedCount],
  );

  const totalPending = useMemo(() => {
    let sum = 0;
    for (const a of awards.filter((x) => x.payout_status === "pending")) {
      const t = tiers.find((x) => x.id === a.tier_id);
      if (t) sum += Number(t.bonus_amount);
    }
    return sum;
  }, [awards, tiers]);

  const totalPaid = useMemo(() => {
    let sum = 0;
    for (const a of awards.filter((x) => x.payout_status === "paid")) {
      const t = tiers.find((x) => x.id === a.tier_id);
      if (t) sum += Number(t.bonus_amount);
    }
    return sum;
  }, [awards, tiers]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (tiers.length === 0) {
    return null;
  }

  const allDone = tiers.every((t) => awardedIds.has(t.id));
  const progress = nextTier
    ? Math.min(100, (confirmedCount / nextTier.threshold_bookings) * 100)
    : 100;
  const remaining = nextTier ? Math.max(0, nextTier.threshold_bookings - confirmedCount) : 0;

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 relative overflow-hidden">
      <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-primary font-semibold">
            <Trophy size={12} /> Missões GoDrive
          </p>
          <h2 className="text-xl sm:text-2xl font-semibold mt-1">Programa de bônus por volume</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Bata metas de reservas confirmadas e receba bônus em dinheiro, além das comissões.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Reservas confirmadas</p>
          <p className="text-3xl font-bold tabular-nums text-primary leading-none mt-1">{confirmedCount}</p>
        </div>
      </div>

      {allDone ? (
        <div className="relative rounded-xl border border-primary/40 bg-primary/5 p-4 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="font-semibold text-sm">Parabéns! Você conquistou todas as missões ativas.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fique de olho — a GoDrive lança novos patamares periodicamente.
            </p>
          </div>
        </div>
      ) : nextTier ? (
        <div className="relative rounded-xl border border-border/40 bg-background/60 p-4 mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div className="inline-flex items-center gap-2">
              <Target size={14} className="text-primary" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Próxima missão</span>
              <span className="text-sm font-semibold">{nextTier.label}</span>
            </div>
            <span className="text-sm font-semibold tabular-nums text-primary">{fmtUSD(nextTier.bonus_amount)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 tabular-nums">
            <strong className="text-foreground">{confirmedCount}</strong> de{" "}
            <strong className="text-foreground">{nextTier.threshold_bookings}</strong> reservas
            {remaining > 0 && (
              <>
                {" · faltam "}
                <strong className="text-primary">{remaining}</strong> para ganhar{" "}
                <strong className="text-primary">{fmtUSD(nextTier.bonus_amount)}</strong>
              </>
            )}
          </p>
        </div>
      ) : null}

      {(totalPending > 0 || totalPaid > 0) && (
        <div className="relative grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-400 font-semibold inline-flex items-center gap-1">
              <Clock size={11} /> Aguardando pagamento
            </p>
            <p className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400 mt-1">{fmtUSD(totalPending)}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
              <Wallet size={11} /> Já recebido
            </p>
            <p className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">{fmtUSD(totalPaid)}</p>
          </div>
        </div>
      )}

      <div className="relative space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Escada de patamares</p>
        {tiers.map((t) => {
          const award = awardByTier[t.id];
          const won = !!award;
          const paid = award?.payout_status === "paid";
          return (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                won
                  ? paid
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-amber-500/40 bg-amber-500/5"
                  : "border-border/40 bg-background/40"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    won
                      ? paid
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {won ? <Check size={14} /> : <Target size={14} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {t.threshold_bookings} reservas confirmadas
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums">{fmtUSD(t.bonus_amount)}</p>
                {won && (
                  <p
                    className={`text-[10px] uppercase tracking-wider font-semibold ${
                      paid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {paid ? "Pago" : "Aguardando"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
