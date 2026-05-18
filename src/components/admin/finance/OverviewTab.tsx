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
  invertCompare?: boolean; // true when higher = worse (cancellation, expenses)
};

const kpisRow1: KpiDef[] = [
  { label: "Receita Total", key: "revenue", icon: TrendingUp, iconColor: "text-emerald-400", format: "currency" },
  { label: "Despesas Totais", key: "expenses", icon: TrendingDown, iconColor: "text-red-400", format: "currency", invertCompare: true },
  { label: "Lucro Líquido", key: "profit", icon: Wallet, iconColor: "text-emerald-400", format: "currency" },
  { label: "Margem", key: "margin", icon: BarChart3, iconColor: "text-sky-400", format: "percent" },
];

const kpisRow2: KpiDef[] = [
  { label: "Ticket Médio", key: "ticket", icon: Receipt, iconColor: "text-amber-400", format: "currency" },
  { label: "Taxa de Ocupação", key: "occupancy", icon: Gauge, iconColor: "text-violet-400", format: "percent" },
  { label: "Reservas no Período", key: "bookingsCount", icon: CalendarCheck, iconColor: "text-emerald-400", format: "number" },
  { label: "Cancelamentos", key: "cancellationRate", icon: XCircle, iconColor: "text-red-400", format: "percent", invertCompare: true },
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
    return <span className="inline-flex items-center text-[10px] font-medium text-zinc-500 mt-2">sem dados anteriores</span>;
  }
  const isUp = delta > 0;
  const good = invert ? !isUp : isUp;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400 bg-zinc-800/60 rounded-full px-2 py-0.5 mt-2">
        — sem variação
      </span>
    );
  }
  const color = good ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10";
  const Icon = isUp ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 mt-2 ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}% vs período anterior
    </span>
  );
}

function KpiCard({ def, current, previous, showCompare }: { def: KpiDef; current: number; previous: number | undefined; showCompare: boolean }) {
  const Icon = def.icon;
  const delta = showCompare && previous !== undefined ? deltaPct(current, previous) : null;
  return (
    <div className="relative rounded-xl bg-zinc-900 border border-zinc-800 p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium">{def.label}</p>
        <Icon className={`h-4 w-4 ${def.iconColor} shrink-0`} />
      </div>
      <p className="text-2xl lg:text-3xl font-bold text-white tabular-nums mt-3 break-words">{fmt(current, def.format)}</p>
      {showCompare && <CompareBadge delta={delta} invert={def.invertCompare} />}
    </div>
  );
}

const periodLabels: Record<Period, string> = { "3m": "3 meses", "6m": "6 meses", "12m": "12 meses", all: "Tudo" };

export function OverviewTab() {
  const data = useFinanceOverview();
  if (data.loading) return <FinanceSkeleton />;

  const { current, previous, showCompare, period, setPeriod, monthlyData, cashFlowData, expensesByType, topVehicles, avgRentalDays, totalsRow } = data;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center bg-zinc-900 border border-zinc-800 rounded-full p-0.5">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                period === p ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpisRow1.map((def) => (
          <KpiCard key={def.key} def={def} current={current[def.key]} previous={previous?.[def.key]} showCompare={showCompare} />
        ))}
      </div>

      {/* KPIs row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpisRow2.map((def) => (
          <KpiCard key={def.key} def={def} current={current[def.key]} previous={previous?.[def.key]} showCompare={showCompare} />
        ))}
      </div>

      {/* Destaques: Top 5 + Tempo médio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              Top 5 Veículos por Receita
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">no período</span>
          </div>
          {topVehicles.length === 0 ? (
            <EmptyState icon={DollarSign} title="Sem receita no período" description="Os veículos com maior faturamento aparecerão aqui." compact />
          ) : (
            <ol className="space-y-3">
              {topVehicles.map((v, idx) => {
                const max = topVehicles[0].revenue || 1;
                const pct = (v.revenue / max) * 100;
                return (
                  <li key={v.vehicleId} className="group">
                    <div className="flex items-center justify-between mb-1.5 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-zinc-400 text-xs font-bold tabular-nums shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm text-white font-medium truncate">{v.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-white tabular-nums">
                          ${v.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-zinc-500 tabular-nums">{v.bookings} reservas</p>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-violet-400" />
              Tempo Médio de Locação
            </h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <p className="text-5xl font-bold text-white tabular-nums">{avgRentalDays.toFixed(1)}</p>
            <p className="text-sm text-zinc-400 mt-1">dias por reserva</p>
            <p className="text-[10px] text-zinc-500 mt-4 text-center">
              média de reservas concluídas
              <br />
              no período selecionado
            </p>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
          <h3 className="text-sm font-bold text-white mb-4">Receita vs Despesas</h3>
          {monthlyData.length === 0 ? (
            <EmptyState icon={BarChart3} title="Sem movimentação" description="Os indicadores aparecem conforme reservas e despesas forem registradas." compact />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  {...darkTooltipProps}
                  formatter={(value: number, name: string) => [
                    `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                    name === "revenue" ? "Receita" : name === "expenses" ? "Despesas" : "Incidentes",
                  ]}
                />
                <Legend formatter={(v) => (v === "revenue" ? "Receita" : v === "expenses" ? "Despesas" : "Incidentes")} />
                <Bar dataKey="revenue" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#f87171" radius={[4, 4, 0, 0]} />
                <Bar dataKey="incidents" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
          <h3 className="text-sm font-bold text-white mb-4">Fluxo de Caixa Acumulado</h3>
          {cashFlowData.length === 0 ? (
            <EmptyState icon={Wallet} title="Sem movimentação" description="O fluxo de caixa aparece conforme houver receita e despesas." compact />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  {...darkTooltipProps}
                  formatter={(value: number) => [`$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Caixa Acumulado"]}
                />
                <Line type="monotone" dataKey="cashFlow" stroke="#34d399" strokeWidth={2.5} dot={{ r: 4, fill: "#34d399" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-white mb-4">Lucro Mensal</h3>
          {monthlyData.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Sem movimentação" description="O lucro mensal aparece com a operação." compact />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  {...darkTooltipProps}
                  formatter={(value: number) => [`$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Lucro"]}
                />
                <Bar dataKey="profit" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
          <h3 className="text-sm font-bold text-white mb-4">Despesas por Categoria</h3>
          {expensesByType.length === 0 ? (
            <EmptyState icon={DollarSign} title="Sem despesas" description="As despesas aparecerão aqui." compact />
          ) : (
            <div className="space-y-3">
              {expensesByType.map((et) => {
                const total = expensesByType.reduce((s, x) => s + x.amount, 0);
                const pct = total > 0 ? (et.amount / total) * 100 : 0;
                return (
                  <div key={et.type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">{et.type}</span>
                      <span className="font-semibold text-white tabular-nums">
                        ${et.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-400/70 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Summary row */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
        <h3 className="text-sm font-bold text-white mb-4">Resumo do Período</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-zinc-400 mb-1">Reservas</p>
            <p className="text-lg font-bold text-white tabular-nums">{totalsRow.active}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-1">Canceladas</p>
            <p className="text-lg font-bold text-red-400 tabular-nums">{totalsRow.cancelled}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-1">Despesas</p>
            <p className="text-lg font-bold text-white tabular-nums">{totalsRow.expensesCount}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-1">Incidentes</p>
            <p className="text-lg font-bold text-white tabular-nums">{totalsRow.incidentsCount}</p>
          </div>
        </div>
      </div>

      {/* Lançamentos manuais info */}
      {current.manual !== 0 && (
        <p className="text-[11px] text-zinc-500 text-right">
          Lançamentos manuais no período:{" "}
          <span className={current.manual >= 0 ? "text-emerald-400" : "text-red-400"}>
            {current.manual >= 0 ? "+" : ""}${current.manual.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </p>
      )}
    </div>
  );
}
