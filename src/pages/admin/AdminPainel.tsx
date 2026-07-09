import { useCallback, useEffect, useMemo, useState } from "react";
import { parseDateOnly } from "@/lib/dateOnly";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Activity, Brain, CalendarDays, CalendarRange, Car, CheckCircle2,
  ChevronRight, Clock, DollarSign, LogIn, LogOut as LogOutIcon,
  TrendingDown, TrendingUp, Wrench, X, ArrowLeft,
} from "lucide-react";
import { createPortal } from "react-dom";

import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useIsMobileApp } from "@/hooks/useIsMobileApp";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { formatPersonName } from "@/lib/formatName";
import MobilePainel from "./mobile/MobilePainel";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import AiPainel from "./AiPainel";
import AiHub from "@/components/admin/ai-studio/AiHub";
import ComingSoonModule from "@/components/admin/ai-studio/ComingSoonModule";
import MarketingStudio from "@/components/admin/ai-studio/MarketingStudio";
import FrotaInteligente from "@/components/admin/ai-studio/FrotaInteligente";
import BrainAccessGate from "@/components/admin/ai-studio/BrainAccessGate";
import {
  type BookingSource,
  readBookingSource,
  writeBookingSource,
  filterBookingsBySource,
  SOURCE_LABEL,
} from "@/lib/aiStudio/bookingSource";
import { AdminKpiGrid } from "@/components/admin/layout/AdminPage";
import PresentationModeButton from "@/components/admin/PresentationModeButton";
import GuidedTourButton from "@/components/admin/guided-tour/GuidedTourButton";




/* ============================================================
   PAINEL — Cockpit executivo
   Single screen, no tabs. Reads top→bottom in 3 zones:
   AGORA (status em tempo real) → HOJE (agenda + ação)
   → MÊS (KPIs com comparação vs. mês anterior).
   Análise profunda (Desempenho, Rentabilidade) vive em /admin/report.
   ============================================================ */

type BookingRow = {
  id: string;
  status: string;
  pickup_date: string;
  return_date: string;
  pickup_time: string | null;
  return_time: string | null;
  total_price: number | null;
  created_at: string;
  vehicle_id: string | null;
  customer_name: string | null;
  stripe_session_id: string | null;
  turo_reservation_code: string | null;
};
type VehicleRow = { id: string; name: string | null; status: string | null; color: string | null };

const ACTIVE_STATUSES = new Set(["confirmed", "active", "in_progress"]);
const PREP_STATUSES   = new Set(["maintenance", "preparing", "cleaning", "in_preparation"]);

const fmtUSD = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;
const fmtNum = (n: number) =>
  Math.round(n).toLocaleString("pt-BR");

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const inMonth = (d: Date, anchor: Date) =>
  d >= startOfMonth(anchor) && d <= endOfMonth(anchor);

function pct(a: number, b: number) {
  if (b === 0) return a === 0 ? 0 : 100;
  return ((a - b) / b) * 100;
}

export default function AdminPainel() {
  const navigate = useNavigate();
  const { hasAny } = useAdminAuth();
  const { isMobile } = useIsMobileApp();
  const showFinancial = hasAny(["admin", "finance"]);
  const canViewFullVehicleData = hasAny(["admin", "operations", "finance", "support"]);

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [inspectionMap, setInspectionMap] = useState<Record<string, { checkin: boolean; checkout: boolean }>>({});
  const [aiMode, setAiMode] = useState<boolean>(() => {
    try { return localStorage.getItem("zeus_ai_mode") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("zeus_ai_mode", aiMode ? "1" : "0"); } catch {}
  }, [aiMode]);

  // hub | painel | marketing | ia — view interna do overlay AI Studio
  type HubView = "hub" | "marketing" | "ia" | "frota-inteligente";
  const [hubView, setHubView] = useState<HubView>("hub");
  // Sempre que abre o Brain, volta ao hub
  useEffect(() => { if (aiMode) setHubView("hub"); }, [aiMode]);

  const [bookingSource, setBookingSource] = useState<BookingSource>(() => readBookingSource());
  useEffect(() => { writeBookingSource(bookingSource); }, [bookingSource]);

  const filteredBookings = useMemo(
    () => filterBookingsBySource(bookings, bookingSource),
    [bookings, bookingSource],
  );








  const load = useCallback(async () => {
    const [b, v] = await Promise.all([
      supabase.from("bookings")
        .select("id, status, pickup_date, return_date, pickup_time, return_time, total_price, created_at, vehicle_id, customer_name, stripe_session_id, turo_reservation_code")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(800),
      canViewFullVehicleData
        ? supabase.from("vehicles")
          .select("id, name, status, color, daily_price_usd, purchase_price, acquired_date, category, brand, model")
          .is("deleted_at", null)
        : supabase.rpc("list_vehicles_basic"),
    ]);

    setBookings((b.data as BookingRow[]) || []);
    setVehicles((v.data as VehicleRow[]) || []);

    // Load inspections so we can hide bookings whose check-in/out is already done
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const todays = ((b.data as BookingRow[]) || []).filter(
      x => x.pickup_date === todayIso || x.return_date === todayIso,
    );
    if (todays.length) {
      const { data: insps } = await supabase
        .from("vehicle_inspections")
        .select("booking_id, type, completed_at")
        .in("booking_id", todays.map(x => x.id));
      const map: Record<string, { checkin: boolean; checkout: boolean }> = {};
      (insps || []).forEach((i: any) => {
        if (!i.completed_at) return;
        if (!map[i.booking_id]) map[i.booking_id] = { checkin: false, checkout: false };
        if (i.type === "checkin") map[i.booking_id].checkin = true;
        if (i.type === "checkout") map[i.booking_id].checkout = true;
      });
      setInspectionMap(map);
    } else {
      setInspectionMap({});
    }

    setLoading(false);
  }, [canViewFullVehicleData]);

  useEffect(() => { void load(); }, [load]);


  const today = todayStr();
  const now = useMemo(() => new Date(), []);
  const monthAnchor = useMemo(() => startOfMonth(now), [now]);
  const prevMonthAnchor = useMemo(() => startOfMonth(subMonths(now, 1)), [now]);
  const monthLabel = format(monthAnchor, "MMMM 'de' yyyy", { locale: ptBR });

  // Vehicle lookup: "Nome (Cor)" or just name
  const vehicleLabel = useCallback((vehicleId: string | null) => {
    if (!vehicleId) return "Veículo não atribuído";
    const v = vehicles.find(x => x.id === vehicleId);
    if (!v) return "Veículo não atribuído";
    const name = v.name || "Veículo";
    return v.color ? `${name} · ${v.color}` : name;
  }, [vehicles]);

  /* ─────────── AGORA ─────────── */
  const rodando = bookings.filter(b =>
    ACTIVE_STATUSES.has(b.status) &&
    b.pickup_date <= today && b.return_date >= today,
  ).length;
  const disponiveis = vehicles.filter(v => v.status === "available").length;
  const emPreparo   = vehicles.filter(v => PREP_STATUSES.has((v.status || "").toLowerCase())).length;
  const pendentes   = bookings.filter(b => b.status === "pending").length;
  const totalFrota  = vehicles.length;
  const ocupacaoNow = totalFrota ? Math.round((rodando / totalFrota) * 100) : 0;

  /* ─────────── HOJE ─────────── */
  const checkinsHoje  = bookings
    .filter(b => b.pickup_date === today && b.status !== "cancelled" && !inspectionMap[b.id]?.checkin)
    .sort((a, b) => (a.pickup_time || "").localeCompare(b.pickup_time || ""));
  const checkoutsHoje = bookings
    .filter(b => b.return_date === today && b.status !== "cancelled" && !inspectionMap[b.id]?.checkout)
    .sort((a, b) => (a.return_time || "").localeCompare(b.return_time || ""));

  const proximaAcao = [...checkinsHoje.map(b => ({ b, kind: "in" as const, t: b.pickup_time })),
                       ...checkoutsHoje.map(b => ({ b, kind: "out" as const, t: b.return_time }))]
    .filter(x => x.t)
    .sort((a, b) => (a.t || "").localeCompare(b.t || ""))[0];

  /* ─────────── MÊS ───────────
     Receita REALIZADA: proporcional aos dias já decorridos dentro do mês.
     Uma reserva de 10 dias com pickup dia 30/jun e retorno 10/jul, se hoje
     é 01/jul, contabiliza apenas 1 dia (não o total). Assim o card reflete
     receita já ganha, não receita futura.
     Reservas canceladas são ignoradas. */
  const isRealBooking = (b: BookingRow) => b.status !== "cancelled";
  const DAY_MS = 86400000;
  const overlapDays = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => {
    const s = aStart > bStart ? aStart : bStart;
    const e = aEnd   < bEnd   ? aEnd   : bEnd;
    if (e < s) return 0;
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / DAY_MS) + 1);
  };
  const proratedRevenue = (b: BookingRow, rangeStart: Date, rangeEnd: Date) => {
    const pk = parseDateOnly(b.pickup_date);
    const rt = parseDateOnly(b.return_date);
    const totalDays = Math.max(1, Math.round((rt.getTime() - pk.getTime()) / DAY_MS) + 1);
    const daysInRange = overlapDays(pk, rt, rangeStart, rangeEnd);
    if (daysInRange <= 0) return 0;
    const daily = (Number(b.total_price) || 0) / totalDays;
    return daily * daysInRange;
  };
  const nowDate = now;
  const monthStart = startOfMonth(monthAnchor);
  const monthEndRealized = nowDate < endOfMonth(monthAnchor) ? nowDate : endOfMonth(monthAnchor);
  const prevStart = startOfMonth(prevMonthAnchor);
  const prevEnd   = endOfMonth(prevMonthAnchor);

  const realBookings  = bookings.filter(isRealBooking);
  const monthBookings = realBookings.filter(b => {
    const pk = parseDateOnly(b.pickup_date);
    const rt = parseDateOnly(b.return_date);
    return rt >= monthStart && pk <= monthEndRealized;
  });
  const prevBookings  = realBookings.filter(b => {
    const pk = parseDateOnly(b.pickup_date);
    const rt = parseDateOnly(b.return_date);
    return rt >= prevStart && pk <= prevEnd;
  });
  const monthRevenue  = monthBookings.reduce((s, b) => s + proratedRevenue(b, monthStart, monthEndRealized), 0);
  const prevRevenue   = prevBookings.reduce((s, b) => s + proratedRevenue(b, prevStart, prevEnd), 0);
  // Contagem: reservas cujo pickup já aconteceu dentro do mês (efetivamente iniciadas).
  const monthCount    = realBookings.filter(b => {
    const pk = parseDateOnly(b.pickup_date);
    return pk >= monthStart && pk <= monthEndRealized;
  }).length;
  const prevCount     = realBookings.filter(b => {
    const pk = parseDateOnly(b.pickup_date);
    return pk >= prevStart && pk <= prevEnd;
  }).length;
  const ticketAvg     = monthCount ? monthRevenue / monthCount : 0;
  const prevTicket    = prevCount  ? prevRevenue  / prevCount  : 0;

  if (loading) return <DashboardSkeleton />;

  // ───── AI Mode toggle (used by both mobile & desktop) ─────
  const AiToggle = (
    <button
      onClick={() => setAiMode(v => !v)}
      title={aiMode ? "Voltar ao painel clássico" : "Ativar AI Studio"}
      aria-label={aiMode ? "Voltar ao painel clássico" : "Ativar AI Studio"}
      className={`group relative inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-[11px] uppercase tracking-[0.18em] font-medium transition-all ${
        aiMode
          ? "text-white border shadow-[0_8px_20px_-10px_rgba(13,29,46,0.45)]"
          : "border border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/30"
      }`}
      style={aiMode ? {
        background: "linear-gradient(180deg, #14283d, #0d1d2e)",
        borderColor: "rgba(154,122,58,0.45)",
      } : undefined}
    >
      <Brain size={14} strokeWidth={1.75} style={aiMode ? { color: "#d6bf86" } : undefined} />
      <span>{aiMode ? "AI Studio ativado" : "AI Studio"}</span>
      {aiMode && (
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full" style={{ background: "#9a7a3a", boxShadow: "0 0 8px rgba(154,122,58,0.7)" }} />
      )}
    </button>
  );

  // ───── AI immersive overlay (mobile + desktop) ─────
  if (aiMode) {
    const overlay = (
      <div
        className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(154,122,58,0.10), transparent 60%), linear-gradient(180deg, #f6f1e6 0%, #efe9dc 60%, #e9e2d2 100%)",
        }}
      >
        <div
          className="sticky top-0 z-[5] flex flex-col gap-2.5 px-4 py-3 backdrop-blur-xl"
          style={{
            paddingTop: "max(12px, env(safe-area-inset-top))",
            background:
              "linear-gradient(180deg, rgba(246,241,230,0.96), rgba(246,241,230,0.65))",
            borderBottom: "1px solid rgba(13,29,46,0.10)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 flex justify-start">
              {hubView !== "hub" && (
                <button
                  onClick={() => setHubView("hub")}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full transition-all hover:opacity-90 text-[11px] uppercase font-semibold tracking-[0.22em]"
                  style={{
                    background: "#fbf7ee",
                    border: "1px solid rgba(13,29,46,0.14)",
                    color: "rgba(13,29,46,0.72)",
                    boxShadow: "0 4px 10px -6px rgba(13,29,46,0.25)",
                  }}
                  aria-label="Voltar ao menu AI Studio"
                >
                  <ArrowLeft size={13} />
                  <span className="hidden sm:inline">Menu</span>
                </button>
              )}
            </div>
            <div
              className="text-[15px] sm:text-[17px] font-light tracking-[0.42em] text-center select-none"
              style={{
                color: "#0d1d2e",
                textShadow: "0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              SUA MARCA BRAIN
            </div>
            <div className="flex-1 flex justify-end">
              <button
                onClick={() => setAiMode(false)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-all hover:opacity-90"
                style={{
                  background: "#fbf7ee",
                  border: "1px solid rgba(13,29,46,0.14)",
                  color: "#0d1d2e",
                  boxShadow: "0 4px 10px -6px rgba(13,29,46,0.25)",
                }}
                aria-label="Sair"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Source selector — só aparece dentro do Hall Estratégico */}
          {hubView === "frota-inteligente" && (
            <div className="flex justify-center">
              <div
                role="tablist"
                aria-label="Origem das reservas"
                className="inline-flex items-center gap-1 p-1 rounded-full"
                style={{
                  background: "rgba(13,29,46,0.05)",
                  border: "1px solid rgba(13,29,46,0.10)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
                }}
              >
                {(["all", "zeus", "turo"] as const).map((s) => {
                  const active = bookingSource === s;
                  return (
                    <button
                      key={s}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setBookingSource(s)}
                      className="relative inline-flex items-center justify-center px-3.5 sm:px-4 h-8 rounded-full text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] transition-all whitespace-nowrap"
                      style={
                        active
                          ? {
                              background: "linear-gradient(180deg, #14283d, #0d1d2e)",
                              color: "#f3e6c4",
                              boxShadow: "0 6px 14px -8px rgba(13,29,46,0.55), 0 0 0 1px rgba(154,122,58,0.45)",
                            }
                          : { color: "rgba(13,29,46,0.60)" }
                      }
                    >
                      {SOURCE_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {hubView === "hub" && (
          <AiHub
            onOpenMarketing={() => setHubView("marketing")}
            onOpenIa={() => setHubView("ia")}
            onOpenFrotaInteligente={() => setHubView("frota-inteligente")}
          />
        )}


        {hubView === "frota-inteligente" && (
          <FrotaInteligente
            onBack={() => setHubView("hub")}
            bookingSource={bookingSource}
          />
        )}

        {hubView === "marketing" && (
          <MarketingStudio onBack={() => setHubView("hub")} />
        )}

        {hubView === "ia" && (
          <ComingSoonModule
            title="Sua Marca IA"
            description="Sua assistente cognitiva dedicada. Pergunte sobre a operação, peça análises, gere relatórios e tome decisões com apoio em tempo real."
            bullets={[
              "Chat com a inteligência da Sua Marca, treinada nos seus dados",
              "Resumos executivos, comparativos e respostas em segundos",
              "Sugestões proativas com base no que está acontecendo agora",
              "Memória persistente do contexto da sua frota",
            ]}
            onBack={() => setHubView("hub")}
          />
        )}
      </div>
    );
    return createPortal(
      <BrainAccessGate onCancel={() => setAiMode(false)}>{overlay}</BrainAccessGate>,
      document.body
    );
  }

  // ───── Mobile-first layout (classic painel) ─────
  if (isMobile) {
    return <MobilePainel bookings={bookings} vehicles={vehicles} onRefresh={load} onToggleAi={() => setAiMode(v => !v)} aiMode={aiMode} />;
  }




  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="min-w-0 hidden md:flex items-start justify-between gap-4">
        <div>
          <h1 className="admin-h1">Painel</h1>
          <p className="text-sm text-muted-foreground/80 mt-1">
            Cockpit operacional · {format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GuidedTourButton />
          <PresentationModeButton />
          {AiToggle}
        </div>
      </div>


      {/* ═════════ AGORA ═════════ */}
      <Zone label="Agora" caption="Status da operação em tempo real" icon={Activity}>
        <AdminKpiGrid cols={4}>
          <KpiCard
            label="Frota rodando"
            value={`${rodando}/${totalFrota}`}
            sub={`${ocupacaoNow}% de ocupação`}
            icon={Car}
            onClick={() => navigate("/admin/live")}
            accent="emerald"
          />
          <KpiCard
            label="Disponíveis"
            value={disponiveis}
            sub="Prontas para locação"
            icon={CheckCircle2}
            onClick={() => navigate("/admin/fleet?status=available")}
          />
          <KpiCard
            label="Em preparo / manutenção"
            value={emPreparo}
            sub={emPreparo === 0 ? "Tudo em dia" : "Aguardando liberação"}
            icon={Wrench}
            onClick={() => navigate("/admin/fleet?status=maintenance")}
            accent={emPreparo > 0 ? "amber" : undefined}
          />
          <KpiCard
            label="Pendências"
            value={pendentes}
            sub={pendentes === 0 ? "Sem pendências" : "Reservas a confirmar"}
            icon={Clock}
            onClick={() => navigate("/admin/bookings?status=pending")}
            accent={pendentes > 0 ? "rose" : undefined}
          />
        </AdminKpiGrid>
      </Zone>

      {/* ═════════ HOJE ═════════ */}
      <Zone label="Hoje" caption="Agenda do dia e próxima ação" icon={CalendarDays}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Próxima ação destacada */}
          <button
            onClick={() => navigate("/admin/ops-today")}
            className="lg:col-span-1 group text-left rounded-xl border border-border/40 bg-card/70 hover:border-foreground/30 hover:bg-card transition-all p-4 flex flex-col justify-between min-h-[140px]"
          >
            <div className="flex items-center justify-between">
              <span className="admin-label">Próxima ação</span>
              <ChevronRight size={14} className="text-muted-foreground/50 group-hover:text-foreground transition-colors" />
            </div>
            {proximaAcao ? (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-light text-foreground leading-none tabular-nums">
                    {proximaAcao.t?.slice(0, 5) || "—"}
                  </span>
                  <span className={`text-[10px] uppercase tracking-[0.14em] font-medium ${
                    proximaAcao.kind === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
                  }`}>
                    {proximaAcao.kind === "in" ? "Check-in" : "Check-out"}
                  </span>
                </div>
                <p className="text-[13px] text-foreground truncate">
                  {vehicleLabel(proximaAcao.b.vehicle_id)}
                </p>
                <p className="text-[11px] text-muted-foreground/70 truncate">
                  {formatPersonName(proximaAcao.b.customer_name || "—")}
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">Nenhuma operação programada para hoje.</p>
            )}
          </button>

          {/* Check-ins */}
          <MiniListCard
            label="Check-ins hoje"
            count={checkinsHoje.length}
            icon={LogIn}
            accent="emerald"
            items={checkinsHoje.slice(0, 3).map(b => ({
              id: b.id,
              left: b.pickup_time?.slice(0, 5) || "—",
              right: vehicleLabel(b.vehicle_id),
              sub: formatPersonName(b.customer_name || ""),
            }))}
            onAll={() => navigate("/admin/ops-today")}
          />

          {/* Check-outs */}
          <MiniListCard
            label="Check-outs hoje"
            count={checkoutsHoje.length}
            icon={LogOutIcon}
            accent="blue"
            items={checkoutsHoje.slice(0, 3).map(b => ({
              id: b.id,
              left: b.return_time?.slice(0, 5) || "—",
              right: vehicleLabel(b.vehicle_id),
              sub: formatPersonName(b.customer_name || ""),
            }))}
            onAll={() => navigate("/admin/ops-today")}
          />
        </div>
      </Zone>

      {/* ═════════ MÊS ═════════ */}
      <Zone
        label="Mês"
        caption={`${monthLabel} · comparado ao mês anterior`}
        icon={CalendarRange}
        action={showFinancial ? { label: "Ver relatório", onClick: () => navigate("/admin/report") } : undefined}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {showFinancial && (
            <DeltaCard
              label="Receita do mês"
              value={monthRevenue}
              format={fmtUSD}
              delta={pct(monthRevenue, prevRevenue)}
              prev={`Anterior: ${fmtUSD(prevRevenue)}`}
              icon={DollarSign}
            />
          )}
          <DeltaCard
            label="Reservas no mês"
            value={monthCount}
            format={fmtNum}
            delta={pct(monthCount, prevCount)}
            prev={`Anterior: ${fmtNum(prevCount)}`}
            icon={CalendarRange}
          />
          {showFinancial && (
            <DeltaCard
              label="Ticket médio"
              value={ticketAvg}
              format={fmtUSD}
              delta={pct(ticketAvg, prevTicket)}
              prev={`Anterior: ${fmtUSD(prevTicket)}`}
              icon={TrendingUp}
            />
          )}
        </div>
      </Zone>
    </div>
  );
}

/* ─────────── Building blocks ─────────── */

function Zone({
  label, caption, icon: Icon, action, children,
}: {
  label: string; caption: string; icon: typeof Activity;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 border-b border-border/30 pb-2">
        <div className="flex items-center gap-2.5">
          <Icon size={14} className="text-muted-foreground/60" strokeWidth={1.75} />
          <h2 className="admin-section-title">{label}</h2>
          <span className="text-[11px] text-muted-foreground/70 hidden sm:inline">· {caption}</span>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            {action.label} <ChevronRight size={11} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

type Accent = "emerald" | "amber" | "rose" | "blue";
const ACCENT_DOT: Record<Accent, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  blue: "bg-blue-500",
};
const ACCENT_TEXT: Record<Accent, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  blue: "text-blue-600 dark:text-blue-400",
};

function KpiCard({
  label, value, sub, icon: Icon, onClick, accent,
}: {
  label: string; value: string | number; sub?: string;
  icon: typeof Activity; onClick?: () => void; accent?: Accent;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex min-h-[128px] flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-card/70 px-4 py-5 text-center transition-all hover:border-foreground/30 hover:bg-card"
    >
      <div className="flex min-h-[16px] items-center justify-center gap-2">
        <span className="admin-label flex items-center justify-center gap-1.5 leading-[1.15]">
          {accent && <span className={`h-1.5 w-1.5 rounded-full ${ACCENT_DOT[accent]}`} />}
          {label}
        </span>
        <Icon size={13} className="text-muted-foreground/50 group-hover:text-foreground transition-colors" strokeWidth={1.75} />
      </div>
      <div className={`admin-kpi leading-[1.05] ${accent ? ACCENT_TEXT[accent] : "text-foreground"}`}>
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
      </div>
      <span className="min-h-[14px] text-[11px] text-muted-foreground/70 leading-[1.2]">{sub ?? "\u00A0"}</span>
    </button>
  );
}

function MiniListCard({
  label, count, icon: Icon, accent, items, onAll,
}: {
  label: string; count: number; icon: typeof Activity; accent: Accent;
  items: { id: string; left: string; right: string; sub?: string }[];
  onAll: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/70 p-4 flex flex-col gap-3 min-h-[140px]">
      <div className="flex items-center justify-between">
        <span className="admin-label flex items-center gap-1.5">
          <Icon size={12} className={ACCENT_TEXT[accent]} strokeWidth={1.75} />
          {label}
        </span>
        <span className={`text-[15px] font-medium tabular-nums ${ACCENT_TEXT[accent]}`}><AnimatedNumber value={count} /></span>
      </div>
      {items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/70 flex-1 flex items-center">
          Nada programado.
        </p>
      ) : (
        <ul className="flex-1 space-y-2">
          {items.map(it => (
            <li key={it.id} className="flex items-start gap-2 text-[12.5px] leading-tight">
              <span className="tabular-nums text-muted-foreground/80 w-10 shrink-0 pt-[1px]">{it.left}</span>
              <div className="min-w-0 flex-1">
                <div className="text-foreground truncate">{it.right}</div>
                {it.sub && (
                  <div className="text-[11px] text-muted-foreground/70 truncate">{it.sub}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {count > 3 && (
        <button
          onClick={onAll}
          className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground self-start transition-colors"
        >
          Ver todos · {count}
        </button>
      )}
    </div>
  );
}

function DeltaCard({
  label, value, delta, prev, icon: Icon, format,
}: {
  label: string; value: number; delta: number; prev: string; icon: typeof Activity; format?: (n: number) => string;
}) {
  const isUp = delta >= 0;
  const isZero = Math.abs(delta) < 0.1;
  const DeltaIcon = isUp ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-xl border border-border/40 bg-card/70 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="admin-label">{label}</span>
        <Icon size={13} className="text-muted-foreground/50" strokeWidth={1.75} />
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="admin-kpi text-foreground">
          <AnimatedNumber value={value} format={format} />
        </span>
        {!isZero && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${
            isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}>
            <DeltaIcon size={11} strokeWidth={2.2} />
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <span className="text-[11px] text-muted-foreground/70 leading-tight">{prev}</span>
    </div>
  );
}

/* Legacy redirects mantidos para compatibilidade com links antigos. */
export function AdminReportRedirect() {
  return <Navigate to="/admin/report" replace />;
}
export function AdminFleetPnLLegacyRedirect() {
  return <Navigate to="/admin/report?tab=rentabilidade" replace />;
}
