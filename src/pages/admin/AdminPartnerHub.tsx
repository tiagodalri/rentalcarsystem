import { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPage, AdminSection, AdminKpiGrid } from "@/components/admin/layout/AdminPage";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { KpiCard } from "@/components/admin/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Handshake, Users, Car, DollarSign, TrendingUp, Loader2, Trophy,
  Check, Undo2, Send, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { fmtUSD, fmtUSDCompact } from "@/lib/partnerFormat";
import { format } from "date-fns";

const AdminPlatformPartners = lazy(() => import("./AdminPlatformPartners"));
const AdminPlatformBonusTiers = lazy(() => import("./AdminPlatformBonusTiers"));

type Overview = {
  active_partners: number;
  total_bookings: number;
  bookings_last_month: number;
  revenue_usd: number;
  commission_paid_usd: number;
  commission_pending_usd: number;
  proposals_sent: number;
  proposals_accepted: number;
  conversion_pct: number;
  top_partners: Array<{ partner_id: string; agency_name: string | null; bookings: number; commission: number }>;
};

type PartnerLite = { id: string; agency_name: string };

type BookingRow = {
  id: string;
  booking_number: string | null;
  pickup_date: string | null;
  return_date: string | null;
  customer_name: string | null;
  total_price: number | null;
  commission_type: string | null;
  commission_value: number | null;
  commission_amount: number | null;
  commission_payout_status: "paid" | "pending" | null;
  commission_paid_at: string | null;
  partner_id: string | null;
  vehicles: { name: string | null; category: string | null } | null;
  locadoras: { name: string | null } | null;
  partners: { agency_name: string | null } | null;
};

type ProposalRow = {
  id: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  locked_price_usd: number | null;
  partners: { agency_name: string | null } | null;
  vehicles: { name: string | null } | null;
};

function payoutBadge(status: string | null | undefined) {
  if (status === "paid") {
    return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 whitespace-nowrap">Pago</Badge>;
  }
  return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 whitespace-nowrap">Pendente</Badge>;
}

function proposalBadge(status: string) {
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

// ============ Overview tab ============
function OverviewTab() {
  const [loading, setLoading] = useState(true);
  const [ov, setOv] = useState<Overview | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("platform-partners-overview", { body: {} });
      if (cancelled) return;
      if (error || !data?.ok) {
        toast.error(error?.message || data?.error || "Erro ao carregar visão geral");
      } else {
        setOv(data.overview);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!ov) return null;

  return (
    <AdminSection>
      <AdminKpiGrid cols={4}>
        <KpiCard label="Parceiros ativos" value={ov.active_partners.toLocaleString("pt-BR")} icon={Users} />
        <KpiCard
          label="Reservas indicadas"
          value={ov.total_bookings.toLocaleString("pt-BR")}
          hint={`${ov.bookings_last_month} nos últimos 30 dias`}
          icon={Car}
        />
        <KpiCard label="Receita da rede" value={fmtUSDCompact(ov.revenue_usd)} icon={DollarSign} />
        <KpiCard
          label="Conversão de propostas"
          value={`${ov.conversion_pct.toFixed(1)}%`}
          hint={`${ov.proposals_accepted} aceitas de ${ov.proposals_sent}`}
          icon={TrendingUp}
        />
      </AdminKpiGrid>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Comissão da rede
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Paga</div>
                <div className="admin-kpi tabular-nums text-2xl text-emerald-600 mt-1">{fmtUSD(ov.commission_paid_usd)}</div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Pendente</div>
                <div className="admin-kpi tabular-nums text-2xl text-amber-600 mt-1">{fmtUSD(ov.commission_pending_usd)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Top 5 parceiros
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ov.top_partners.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma comissão registrada ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {ov.top_partners.map((t, i) => (
                  <div key={t.partner_id} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-sm font-medium truncate">{t.agency_name ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
                      <span className="text-muted-foreground">{t.bookings} res.</span>
                      <span className="font-semibold">{fmtUSD(t.commission)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminSection>
  );
}

// ============ Payouts tab ============
function PayoutsTab() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [partners, setPartners] = useState<PartnerLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const body: Record<string, unknown> = { limit: 500 };
    if (partnerFilter !== "all") body.partner_id = partnerFilter;
    if (statusFilter !== "all") body.payout_status = statusFilter;
    const { data, error } = await supabase.functions.invoke("platform-list-partner-bookings", { body });
    if (error || !data?.ok) {
      toast.error(error?.message || data?.error || "Erro ao carregar repasses");
      setRows([]);
    } else {
      setRows(data.rows as BookingRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Load partners list once for the filter
    supabase.from("partners").select("id, agency_name").order("agency_name").then(({ data }) => {
      setPartners((data ?? []) as PartnerLite[]);
    });
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerFilter, statusFilter]);

  const toggle = async (r: BookingRow) => {
    const next = r.commission_payout_status === "paid" ? "pending" : "paid";
    setUpdatingId(r.id);
    const { data, error } = await supabase.functions.invoke("platform-mark-commission-paid", {
      body: { booking_id: r.id, status: next },
    });
    setUpdatingId(null);
    if (error || !data?.ok) {
      toast.error(error?.message || data?.error || "Erro ao atualizar repasse");
      return;
    }
    toast.success(next === "paid" ? "Comissão marcada como paga" : "Repasse revertido para pendente");
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, commission_payout_status: next, commission_paid_at: data.booking.commission_paid_at } : x)));
  };

  return (
    <AdminSection>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px]">
          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger><SelectValue placeholder="Parceiro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os parceiros</SelectItem>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.agency_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {loading ? "Carregando…" : `${rows.length} reserva${rows.length === 1 ? "" : "s"}`}
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Parceiro</th>
                <th className="text-left px-4 py-2.5">Veículo</th>
                <th className="text-left px-4 py-2.5">Locadora</th>
                <th className="text-left px-4 py-2.5">Retirada</th>
                <th className="text-right px-4 py-2.5">Total</th>
                <th className="text-right px-4 py-2.5">Comissão</th>
                <th className="text-center px-4 py-2.5">Repasse</th>
                <th className="text-right px-4 py-2.5">Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-primary" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">Nenhuma reserva encontrada.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-4 py-2.5 font-medium">{r.partners?.agency_name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="truncate max-w-[200px]">{r.vehicles?.name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{r.vehicles?.category ?? ""}</div>
                  </td>
                  <td className="px-4 py-2.5">{r.locadoras?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.pickup_date ? format(new Date(r.pickup_date), "dd/MM/yyyy") : "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{fmtUSD(Number(r.total_price ?? 0))}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                    <div className="font-semibold">{fmtUSD(Number(r.commission_amount ?? 0))}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {r.commission_type === "percent" ? `${Number(r.commission_value ?? 0)}%` : r.commission_type === "fixed" ? "fixa" : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">{payoutBadge(r.commission_payout_status)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant={r.commission_payout_status === "paid" ? "outline" : "default"}
                      disabled={updatingId === r.id}
                      onClick={() => toggle(r)}
                    >
                      {updatingId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : r.commission_payout_status === "paid" ? (
                        <><Undo2 className="h-3.5 w-3.5 mr-1" /> Reverter</>
                      ) : (
                        <><Check className="h-3.5 w-3.5 mr-1" /> Marcar pago</>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AdminSection>
  );
}

// ============ Proposals tab ============
function ProposalsTab() {
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("platform-list-proposals", { body: {} });
      if (error || !data?.ok) {
        toast.error(error?.message || data?.error || "Erro ao carregar propostas");
        setRows([]);
      } else {
        setRows(data.rows as ProposalRow[]);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.customer_name ?? "").toLowerCase().includes(q) ||
      (r.partners?.agency_name ?? "").toLowerCase().includes(q) ||
      (r.vehicles?.name ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const accepted = rows.filter((r) => r.status === "accepted").length;
    const expired = rows.filter((r) => r.status === "expired").length;
    const cancelled = rows.filter((r) => r.status === "cancelled").length;
    const conv = total > 0 ? (accepted / total) * 100 : 0;
    return { total, accepted, expired, cancelled, conv };
  }, [rows]);

  return (
    <AdminSection>
      <AdminKpiGrid cols={5}>
        <KpiCard label="Enviadas" value={kpis.total} compact />
        <KpiCard label="Aceitas" value={kpis.accepted} valueClassName="text-emerald-600" compact />
        <KpiCard label="Expiradas" value={kpis.expired} valueClassName="text-muted-foreground" compact />
        <KpiCard label="Canceladas" value={kpis.cancelled} valueClassName="text-red-600" compact />
        <KpiCard label="Conversão" value={`${kpis.conv.toFixed(1)}%`} compact />
      </AdminKpiGrid>

      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente, parceiro ou veículo…"
          className="max-w-sm"
        />
        <div className="ml-auto text-xs text-muted-foreground">
          {loading ? "Carregando…" : `${filtered.length} de ${rows.length}`}
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Parceiro</th>
                <th className="text-left px-4 py-2.5">Cliente</th>
                <th className="text-left px-4 py-2.5">Veículo</th>
                <th className="text-right px-4 py-2.5">Preço</th>
                <th className="text-center px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Criada</th>
                <th className="text-left px-4 py-2.5">Expira</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-primary" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Nenhuma proposta encontrada.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-4 py-2.5 font-medium">{r.partners?.agency_name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div>{r.customer_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{r.customer_email ?? ""}</div>
                  </td>
                  <td className="px-4 py-2.5">{r.vehicles?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{fmtUSD(Number(r.locked_price_usd ?? 0))}</td>
                  <td className="px-4 py-2.5 text-center">{proposalBadge(r.status)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{format(new Date(r.created_at), "dd/MM/yyyy")}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.expires_at ? format(new Date(r.expires_at), "dd/MM/yyyy") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AdminSection>
  );
}

// ============ Main page ============
export default function AdminPartnerHub() {
  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow={<span className="inline-flex items-center gap-2"><Handshake className="h-3.5 w-3.5" /> GoDalz HQ</span>}
        title="Central de Parceiros"
        subtitle="Gestão completa da rede de agências parceiras GoDalz."
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="directory">Diretório</TabsTrigger>
          <TabsTrigger value="payouts">Repasses</TabsTrigger>
          <TabsTrigger value="proposals">Propostas</TabsTrigger>
          <TabsTrigger value="missions">Missões</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="directory" className="mt-4">
          <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
            <AdminPlatformPartners />
          </Suspense>
        </TabsContent>
        <TabsContent value="payouts" className="mt-4"><PayoutsTab /></TabsContent>
        <TabsContent value="proposals" className="mt-4"><ProposalsTab /></TabsContent>
        <TabsContent value="missions" className="mt-4">
          <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
            <AdminPlatformBonusTiers />
          </Suspense>
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}
