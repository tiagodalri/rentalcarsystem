import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, Car, Trophy, Target, CheckCircle2, Clock, XCircle, Send } from "lucide-react";
import { fmtUSD } from "@/lib/partnerFormat";
import { format } from "date-fns";
import { toast } from "sonner";

interface Props {
  partnerId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type Detail = {
  partner: {
    id: string;
    agency_name: string;
    status: string;
    created_at: string;
    contact_email: string | null;
    contact_phone: string | null;
  };
  kpis: {
    total_bookings: number;
    commission_paid_usd: number;
    commission_pending_usd: number;
    confirmed_count: number;
  };
  recent_bookings: Array<{
    id: string;
    booking_number: string | null;
    pickup_date: string | null;
    total_price: number | null;
    commission_amount: number | null;
    commission_payout_status: string | null;
    status: string;
    vehicles: { name: string | null } | null;
  }>;
  recent_proposals: Array<{
    id: string;
    status: string;
    created_at: string;
    customer_name: string | null;
    total_price: number | null;
    vehicles: { name: string | null } | null;
  }>;
  mission: {
    label: string | null;
    bonus_amount: number;
    threshold: number;
    confirmed_count: number;
    progress_pct: number;
    remaining: number;
    all_done: boolean;
  };
};

function proposalStatusBadge(status: string) {
  const map: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    sent: { label: "Enviada", cls: "bg-blue-500/15 text-blue-700 border-blue-500/30", Icon: Send },
    accepted: { label: "Aceita", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", Icon: CheckCircle2 },
    expired: { label: "Expirada", cls: "bg-muted text-muted-foreground border-border", Icon: Clock },
    cancelled: { label: "Cancelada", cls: "bg-red-500/15 text-red-700 border-red-500/30", Icon: XCircle },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border", Icon: Clock };
  const Icon = cfg.Icon;
  return (
    <Badge className={`${cfg.cls} whitespace-nowrap gap-1`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

export default function PartnerDetailSheet({ partnerId, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Detail | null>(null);

  useEffect(() => {
    if (!open || !partnerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setData(null);
      const { data: res, error } = await supabase.functions.invoke("platform-partner-detail", {
        body: { partner_id: partnerId },
      });
      if (cancelled) return;
      if (error || !res?.ok) {
        toast.error(error?.message || res?.error || "Erro ao carregar detalhes");
        setLoading(false);
        return;
      }
      setData(res as Detail);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, partnerId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{data?.partner.agency_name ?? "Detalhes do parceiro"}</SheetTitle>
          <SheetDescription>
            {data ? (
              <>
                Cadastrado em {format(new Date(data.partner.created_at), "dd/MM/yyyy")} — Status: {data.partner.status}
              </>
            ) : "Carregando informações do parceiro…"}
          </SheetDescription>
        </SheetHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <Car className="h-3 w-3" /> Reservas
                </div>
                <div className="text-xl font-bold tabular-nums mt-1">{data.kpis.total_bookings}</div>
              </div>
              <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <DollarSign className="h-3 w-3" /> Comissão paga
                </div>
                <div className="text-xl font-bold tabular-nums text-emerald-600 mt-1">{fmtUSD(data.kpis.commission_paid_usd)}</div>
              </div>
              <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <DollarSign className="h-3 w-3" /> Comissão pendente
                </div>
                <div className="text-xl font-bold tabular-nums text-amber-600 mt-1">{fmtUSD(data.kpis.commission_pending_usd)}</div>
              </div>
              <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <CheckCircle2 className="h-3 w-3" /> Confirmadas
                </div>
                <div className="text-xl font-bold tabular-nums mt-1">{data.kpis.confirmed_count}</div>
              </div>
            </div>

            {/* Mission */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Missão atual</span>
              </div>
              {data.mission.all_done ? (
                <p className="text-sm">Todas as missões conquistadas.</p>
              ) : data.mission.label ? (
                <>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-sm font-semibold truncate">{data.mission.label}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-primary shrink-0">{fmtUSD(data.mission.bonus_amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all" style={{ width: `${data.mission.progress_pct}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
                    <strong className="text-foreground">{data.mission.confirmed_count}</strong> de{" "}
                    <strong className="text-foreground">{data.mission.threshold}</strong> reservas
                    {data.mission.remaining > 0 && (<> · faltam <strong className="text-primary">{data.mission.remaining}</strong></>)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum patamar ativo configurado.</p>
              )}
            </div>

            {/* Recent bookings */}
            <div>
              <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Últimas reservas</h3>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Veículo</th>
                      <th className="text-left px-3 py-2">Retirada</th>
                      <th className="text-right px-3 py-2">Total</th>
                      <th className="text-right px-3 py-2">Comissão</th>
                      <th className="text-center px-3 py-2">Repasse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_bookings.length === 0 ? (
                      <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhuma reserva.</td></tr>
                    ) : data.recent_bookings.map((b) => (
                      <tr key={b.id} className="border-t border-border/40">
                        <td className="px-3 py-2 truncate max-w-[160px]">{b.vehicles?.name ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{b.pickup_date ? format(new Date(b.pickup_date), "dd/MM/yyyy") : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtUSD(Number(b.total_price ?? 0))}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtUSD(Number(b.commission_amount ?? 0))}</td>
                        <td className="px-3 py-2 text-center">
                          {b.commission_payout_status === "paid" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 whitespace-nowrap text-[10px]">Pago</Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 whitespace-nowrap text-[10px]">Pendente</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent proposals */}
            <div>
              <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Últimas propostas</h3>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Cliente</th>
                      <th className="text-left px-3 py-2">Veículo</th>
                      <th className="text-right px-3 py-2">Preço</th>
                      <th className="text-center px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_proposals.length === 0 ? (
                      <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Nenhuma proposta.</td></tr>
                    ) : data.recent_proposals.map((p) => (
                      <tr key={p.id} className="border-t border-border/40">
                        <td className="px-3 py-2 truncate max-w-[140px]">{p.customer_name ?? "—"}</td>
                        <td className="px-3 py-2 truncate max-w-[140px]">{p.vehicles?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtUSD(Number(p.total_price ?? 0))}</td>
                        <td className="px-3 py-2 text-center">{proposalStatusBadge(p.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
