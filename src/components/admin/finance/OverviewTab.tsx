import { useFinanceOverview, type Period, type Kpis } from "@/hooks/useFinanceOverview";
import { FinanceSkeleton } from "@/components/skeletons/FinanceSkeleton";
import { EmptyState } from "@/components/admin/EmptyState";
import { darkTooltipProps } from "@/components/admin/ChartTooltip";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  Receipt,
  Gauge,
  CalendarCheck,
  XCircle,
  ArrowUp,
  ArrowDown,
  Trophy,
  Clock,
  DollarSign,
  type LucideIcon,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

type KpiKey = keyof Kpis;

type KpiDef = {
  label: string;
  key: KpiKey;
  icon: LucideIcon;
  iconColor: string;
  format: "currency" | "percent" | "number" | "decimal";
  invertCompare?: boolean;
  emphasis?: boolean; // adds left accent bar (Lucro)
};

const kpisRow1: KpiDef[] = [
  { label: "Receita Total", key: "revenue", icon: TrendingUp, iconColor: "text-emerald-500", format: "currency" },
  { label: "Despesas Totais", key: "expenses", icon: TrendingDown, iconColor: "text-rose-500", format: "currency", invertCompare: true },
  { label: "Lucro Líquido", key: "profit", icon: Wallet, iconColor: "text-primary", format: "currency", emphasis: true },
  { label: "Margem", key: "margin", icon: BarChart3, iconColor: "text-sky-500", format: "percent" },
];

const kpisRow2: KpiDef[] = [
  { label: "Ticket Médio", key: "ticket", icon: Receipt, iconColor: "text-primary", format: "currency" },
  { label: "Taxa de Ocupação", key: "occupancy", icon: Gauge, iconColor: "text-violet-500", format: "percent" },
  { label: "Reservas no Período", key: "bookingsCount", icon: CalendarCheck, iconColor: "text-emerald-500", format: "number" },
  { label: "Cancelamentos", key: "cancellationRate", icon: XCircle, iconColor: "text-rose-500", format: "percent", invertCompare: true },
];

function fmt(value: number, type: KpiDef["format"]): string {
  if (type === "currency") return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (type === "percent") return `${value.toFixed(1)}%`;
  if (type === "decimal") return value.toFixed(1);
  return Math.round(value).toLocaleString("pt-BR");
}

function deltaPct(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function CompareBadge({ delta, invert }: { delta: number | null; invert?: boolean }) {
  if (delta === null) {
    return <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60 mt-2">sem dados anteriores</span>;
  }
  if (delta === 0) {
    return <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60 mt-2">sem variação</span>;
  }
  const isUp = delta > 0;
  const good = invert ? !isUp : isUp;
  const color = good ? "text-emerald-600/90 dark:text-emerald-400/90" : "text-rose-600/90 dark:text-rose-400/90";
  const Icon = isUp ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium tabular-nums mt-2 ${color}`}>
      <Icon className="h-3 w-3" strokeWidth={2} />
      {Math.abs(delta).toFixed(1)}% vs período anterior
    </span>
  );
}

function KpiCard({ def, current, previous, showCompare }: { def: KpiDef; current: number; previous: number | undefined; showCompare: boolean }) {
  const Icon = def.icon;
  const delta = showCompare && previous !== undefined ? deltaPct(current, previous) : null;
  return (
    <div
      className={`relative rounded-lg bg-card border border-border/70 p-5 transition-colors ${
        def.emphasis ? "border-l-2 border-l-primary/70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-medium">{def.label}</p>
        <Icon className={`h-3.5 w-3.5 ${def.iconColor} opacity-70 shrink-0`} strokeWidth={1.75} />
      </div>
      <p className="text-[22px] leading-tight font-light text-foreground tabular-nums mt-4 break-words tracking-[-0.01em]">
        {fmt(current, def.format)}
      </p>
      {showCompare && <CompareBadge delta={delta} invert={def.invertCompare} />}
    </div>
  );
}

const periodLabels: Record<Period, string> = { "3m": "3 meses", "6m": "6 meses", "12m": "12 meses", all: "Tudo" };

// Circular gauge for "Tempo Médio de Locação"
function RentalDaysGauge({ days }: { days: number }) {
  const max = 30;
  const pct = Math.min(days / max, 1);
  const r = 58;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div className="relative flex items-center justify-center">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} className="stroke-muted" strokeWidth="8" fill="transparent" />
        <circle
          cx="64"
          cy="64"
          r={r}
          className="stroke-primary"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-light text-foreground tabular-nums tracking-[-0.02em]">{days.toFixed(1)}</span>
        <span className="text-[10px] font-medium text-muted-foreground/80 uppercase tracking-[0.16em] mt-0.5">dias</span>
      </div>
    </div>
  );
}

export function OverviewTab() {
  const data = useFinanceOverview();
  if (data.loading) return <FinanceSkeleton />;

  const { current, previous, showCompare, period, setPeriod, monthlyData, cashFlowData, expensesByType, topVehicles, avgRentalDays, totalsRow } = data;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center bg-card border border-border/70 rounded-full p-0.5">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-[10px] uppercase tracking-[0.16em] px-3 py-1 rounded-full font-medium transition-all ${
                period === p
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpisRow1.map((def) => (
          <KpiCard key={def.key} def={def} current={current[def.key]} previous={previous?.[def.key]} showCompare={showCompare} />
        ))}
      </div>

      {/* KPIs row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpisRow2.map((def) => (
          <KpiCard key={def.key} def={def} current={current[def.key]} previous={previous?.[def.key]} showCompare={showCompare} />
        ))}
      </div>

      {/* Destaques: Top 5 + Tempo médio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-lg bg-card border border-border/70 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <Trophy className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
              <h3 className="text-[11px] font-medium text-foreground uppercase tracking-[0.16em]">Top 5 Veículos por Receita</h3>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">No Período</span>
          </div>
          {topVehicles.length === 0 ? (
            <EmptyState icon={DollarSign} title="Sem receita no período" description="Os veículos com maior faturamento aparecerão aqui." compact />
          ) : (
            <ol className="space-y-5">
              {topVehicles.map((v, idx) => {
                const max = topVehicles[0].revenue || 1;
                const pct = (v.revenue / max) * 100;
                const isTop = idx === 0;
                return (
                  <li key={v.vehicleId} className="space-y-2">
                    <div className="flex items-center justify-between text-sm gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`text-[10px] font-medium tabular-nums shrink-0 w-5 ${
                            isTop ? "text-foreground" : "text-muted-foreground/70"
                          }`}
                        >
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="text-sm font-normal text-foreground truncate">{v.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-normal text-foreground tabular-nums tracking-[-0.01em]">
                          ${v.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 tabular-nums">{v.bookings} reservas</p>
                      </div>
                    </div>
                    <div className="h-px w-full bg-border/60 overflow-hidden">
                      <div
                        className={`h-full transition-all ${isTop ? "bg-primary/70" : "bg-muted-foreground/30"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="rounded-lg bg-card border border-border/70 p-6 flex flex-col items-center justify-center text-center">
          <Clock className="h-4 w-4 text-muted-foreground/70 mb-4" strokeWidth={1.75} />
          <h3 className="text-[10px] font-medium text-muted-foreground/80 uppercase tracking-[0.16em] mb-5">
            Tempo Médio de Locação
          </h3>
          <RentalDaysGauge days={avgRentalDays} />
          <p className="text-xs font-normal text-muted-foreground mt-5">dias por reserva</p>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-3 max-w-[200px]">
            Média baseada em reservas concluídas no período selecionado.
          </p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg bg-card border border-border/70 p-6">
          <h3 className="text-[11px] font-medium text-foreground uppercase tracking-[0.16em] mb-5">Receita vs Despesas</h3>
          {monthlyData.length === 0 ? (
            <EmptyState icon={BarChart3} title="Sem movimentação" description="Os indicadores aparecem conforme reservas e despesas forem registradas." compact />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  {...darkTooltipProps}
                  formatter={(value: number, name: string) => [
                    `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                    name === "revenue" ? "Receita" : name === "expenses" ? "Despesas" : "Incidentes",
                  ]}
                />
                <Legend formatter={(v) => (v === "revenue" ? "Receita" : v === "expenses" ? "Despesas" : "Incidentes")} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="incidents" fill="#a1a1aa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg bg-card border border-border/70 p-6">
          <h3 className="text-[11px] font-medium text-foreground uppercase tracking-[0.16em] mb-5">Fluxo de Caixa Acumulado</h3>
          {cashFlowData.length === 0 ? (
            <EmptyState icon={Wallet} title="Sem movimentação" description="O fluxo de caixa aparece conforme houver receita e despesas." compact />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  {...darkTooltipProps}
                  formatter={(value: number) => [`$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Caixa Acumulado"]}
                />
                <Line type="monotone" dataKey="cashFlow" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-lg bg-card border border-border/70 p-6 lg:col-span-2">
          <h3 className="text-[11px] font-medium text-foreground uppercase tracking-[0.16em] mb-5">Lucro Mensal</h3>
          {monthlyData.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Sem movimentação" description="O lucro mensal aparece com a operação." compact />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  {...darkTooltipProps}
                  formatter={(value: number) => [`$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Lucro"]}
                />
                <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg bg-card border border-border/70 p-6">
          <h3 className="text-[11px] font-medium text-foreground uppercase tracking-[0.16em] mb-5">Despesas por Categoria</h3>
          {expensesByType.length === 0 ? (
            <EmptyState icon={DollarSign} title="Sem despesas" description="As despesas aparecerão aqui." compact />
          ) : (
            <div className="space-y-4">
              {expensesByType.map((et) => {
                const total = expensesByType.reduce((s, x) => s + x.amount, 0);
                const pct = total > 0 ? (et.amount / total) * 100 : 0;
                return (
                  <div key={et.type}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground/80 font-normal">{et.type}</span>
                      <span className="font-normal text-foreground tabular-nums">
                        ${et.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-px rounded-full bg-border/60 overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Summary row */}
      <div className="rounded-lg bg-card border border-border/70 p-6">
        <h3 className="text-[11px] font-medium text-foreground uppercase tracking-[0.16em] mb-5">Resumo do Período</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="border-r border-border/60 last:border-r-0 md:border-r">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80 mb-2">Reservas</p>
            <p className="text-xl font-light text-foreground tabular-nums tracking-[-0.01em]">{totalsRow.active}</p>
          </div>
          <div className="md:border-r border-border/60">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80 mb-2">Canceladas</p>
            <p className="text-xl font-light text-rose-600/90 dark:text-rose-400/90 tabular-nums tracking-[-0.01em]">{totalsRow.cancelled}</p>
          </div>
          <div className="border-r border-border/60 last:border-r-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80 mb-2">Despesas</p>
            <p className="text-xl font-light text-foreground tabular-nums tracking-[-0.01em]">{totalsRow.expensesCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80 mb-2">Incidentes</p>
            <p className="text-xl font-light text-foreground tabular-nums tracking-[-0.01em]">{totalsRow.incidentsCount}</p>
          </div>
        </div>
      </div>

      {/* Lançamentos manuais info */}
      {current.manual !== 0 && (
        <p className="text-[11px] text-muted-foreground text-right">
          Lançamentos manuais no período:{" "}
          <span className={current.manual >= 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-rose-600 dark:text-rose-400 font-semibold"}>
            {current.manual >= 0 ? "+" : ""}${current.manual.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </p>
      )}
    </div>
  );
}
