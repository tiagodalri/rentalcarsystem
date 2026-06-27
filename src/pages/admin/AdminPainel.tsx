import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Activity, Brain, CalendarDays, CalendarRange, Car, CheckCircle2,
  ChevronRight, Clock, DollarSign, LogIn, LogOut as LogOutIcon,
  TrendingDown, TrendingUp, Wrench, X,
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

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [aiMode, setAiMode] = useState<boolean>(() => {
    try { return localStorage.getItem("zeus_ai_mode") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("zeus_ai_mode", aiMode ? "1" : "0"); } catch {}
  }, [aiMode]);


  const load = useCallback(async () => {
    const [b, v] = await Promise.all([
      supabase.from("bookings")
        .select("id, status, pickup_date, return_date, pickup_time, return_time, total_price, created_at, vehicle_id, customer_name")
        .order("created_at", { ascending: false })
        .limit(800),
      supabase.from("vehicles")
        .select("id, name, status, color, daily_price_usd, purchase_price, acquired_date, category, brand, model")
        .is("deleted_at", null),
    ]);

    setBookings((b.data as BookingRow[]) || []);
    setVehicles((v.data as VehicleRow[]) || []);
    setLoading(false);
  }, []);

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
    .filter(b => b.pickup_date === today && b.status !== "cancelled")
    .sort((a, b) => (a.pickup_time || "").localeCompare(b.pickup_time || ""));
  const checkoutsHoje = bookings
    .filter(b => b.return_date === today && b.status !== "cancelled")
    .sort((a, b) => (a.return_time || "").localeCompare(b.return_time || ""));

  const proximaAcao = [...checkinsHoje.map(b => ({ b, kind: "in" as const, t: b.pickup_time })),
                       ...checkoutsHoje.map(b => ({ b, kind: "out" as const, t: b.return_time }))]
    .filter(x => x.t)
    .sort((a, b) => (a.t || "").localeCompare(b.t || ""))[0];

  /* ─────────── MÊS ───────────
     Considera reservas com pickup dentro do mês e exclui canceladas
     (a métrica reflete operação efetiva, não data de criação). */
  const isRealBooking = (b: BookingRow) => b.status !== "cancelled";
  const monthBookings = bookings.filter(b => isRealBooking(b) && inMonth(new Date(b.pickup_date), monthAnchor));
  const prevBookings  = bookings.filter(b => isRealBooking(b) && inMonth(new Date(b.pickup_date), prevMonthAnchor));
  const monthRevenue  = monthBookings.reduce((s, b) => s + (Number(b.total_price) || 0), 0);
  const prevRevenue   = prevBookings.reduce((s, b) => s + (Number(b.total_price) || 0), 0);
  const monthCount    = monthBookings.length;
  const prevCount     = prevBookings.length;
  const ticketAvg     = monthCount ? monthRevenue / monthCount : 0;
  const prevTicket    = prevCount  ? prevRevenue  / prevCount  : 0;

  if (loading) return <DashboardSkeleton />;

  // ───── AI Mode toggle (used by both mobile & desktop) ─────
  const AiToggle = (
    <button
      onClick={() => setAiMode(v => !v)}
      title={aiMode ? "Voltar ao painel clássico" : "Ativar modo IA"}
      aria-label={aiMode ? "Voltar ao painel clássico" : "Ativar modo IA"}
      className={`group relative inline-flex items-center gap-2 px-3 py-2 rounded-full text-[11px] uppercase tracking-[0.16em] font-medium transition-all ${
        aiMode
          ? "bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 text-white border border-cyan-300/40 shadow-[0_0_24px_rgba(120,180,255,0.35)]"
          : "border border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/30"
      }`}
    >
      <Brain size={14} strokeWidth={1.75} className={aiMode ? "text-cyan-200" : ""} />
      <span>{aiMode ? "IA Ativada" : "Modo IA"}</span>
      {aiMode && (
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(92,255,176,0.8)] animate-pulse" />
      )}
    </button>
  );

  // ───── AI immersive overlay (mobile + desktop) ─────
  if (aiMode) {
    const overlay = (
      <div
        className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain"
        style={{ background: "radial-gradient(ellipse at top, #0b1830 0%, #050813 55%, #02030a 100%)" }}
      >
        <div
          className="sticky top-0 z-[5] flex items-center justify-between gap-3 px-4 py-3 backdrop-blur-xl"
          style={{
            paddingTop: "max(12px, env(safe-area-inset-top))",
            background: "linear-gradient(180deg, rgba(5,8,19,0.92), rgba(5,8,19,0.55))",
            borderBottom: "1px solid rgba(120,180,255,0.12)",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="grid place-items-center w-8 h-8 rounded-xl shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(120,180,255,0.35), rgba(180,120,255,0.35))",
                boxShadow: "0 0 18px rgba(120,180,255,0.4)",
              }}
            >
              <Brain size={15} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] uppercase tracking-[0.22em] text-cyan-200/80">Zeus Intelligence</div>
              <div className="text-[12px] text-white/90 truncate">Modo IA ativado</div>
            </div>
          </div>
          <button
            onClick={() => setAiMode(false)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10.5px] uppercase tracking-[0.16em] font-medium text-white/90 transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              minHeight: 40,
            }}
          >
            <X size={14} />
            <span className="hidden xs:inline sm:inline">Sair do modo IA</span>
            <span className="xs:hidden sm:hidden">Sair</span>
          </button>
        </div>
        <div className="px-3 sm:px-4 lg:px-6 pb-10 overflow-x-hidden">
          <AiPainel bookings={bookings as any} vehicles={vehicles as any} />
        </div>
      </div>
    );
    return createPortal(overlay, document.body);
  }

  // ───── Mobile-first layout (classic painel) ─────
  if (isMobile) {
    return <MobilePainel bookings={bookings} vehicles={vehicles} onRefresh={load} onToggleAi={() => setAiMode(v => !v)} aiMode={aiMode} />;
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="min-w-0 hidden lg:flex items-start justify-between gap-4">
        <div>
          <h1 className="admin-h1">Painel</h1>
          <p className="text-sm text-muted-foreground/80 mt-1">
            Cockpit operacional · {format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        {AiToggle}
      </div>


      {/* ═════════ AGORA ═════════ */}
      <Zone label="Agora" caption="Status da operação em tempo real" icon={Activity}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
        </div>
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
      className="group text-left rounded-xl border border-border/40 bg-card/70 hover:border-foreground/30 hover:bg-card transition-all p-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="admin-label flex items-center gap-1.5">
          {accent && <span className={`h-1.5 w-1.5 rounded-full ${ACCENT_DOT[accent]}`} />}
          {label}
        </span>
        <Icon size={13} className="text-muted-foreground/50 group-hover:text-foreground transition-colors" strokeWidth={1.75} />
      </div>
      <div className={`admin-kpi ${accent ? ACCENT_TEXT[accent] : "text-foreground"}`}>
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
      </div>
      {sub && <span className="text-[11px] text-muted-foreground/70 leading-tight">{sub}</span>}
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
