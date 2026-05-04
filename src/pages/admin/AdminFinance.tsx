import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Wallet, BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { FinanceSkeleton } from "@/components/skeletons/FinanceSkeleton";

type Booking = {
  id: string;
  total_price: number | null;
  status: string;
  pickup_date: string;
  return_date: string;
  created_at: string;
};

type Expense = {
  id: string;
  amount: number;
  type: string;
  expense_date: string;
  description: string | null;
  vehicle_id: string;
};

type Incident = {
  id: string;
  actual_cost: number | null;
  status: string;
  incident_date: string;
};

const expenseTypeLabels: Record<string, string> = {
  maintenance: "Manutenção",
  insurance: "Seguro",
  fine: "Multa",
  fuel: "Combustível",
  documentation: "Documentação",
  parts: "Peças",
  cleaning: "Limpeza",
  other: "Outros",
};

export default function AdminFinance() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"3m" | "6m" | "12m" | "all">("6m");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [bRes, eRes, iRes] = await Promise.all([
        supabase.from("bookings").select("id, total_price, status, pickup_date, return_date, created_at"),
        supabase.from("vehicle_expenses").select("id, amount, type, expense_date, description, vehicle_id"),
        supabase.from("vehicle_incidents").select("id, actual_cost, status, incident_date"),
      ]);
      setBookings((bRes.data as Booking[]) || []);
      setExpenses((eRes.data as Expense[]) || []);
      setIncidents((iRes.data as Incident[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const periodStart = useMemo(() => {
    if (period === "all") return new Date(2000, 0, 1);
    const d = new Date();
    const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
    d.setMonth(d.getMonth() - months);
    return d;
  }, [period]);

  const filteredBookings = bookings.filter((b) => new Date(b.created_at) >= periodStart);
  const filteredExpenses = expenses.filter((e) => new Date(e.expense_date) >= periodStart);
  const filteredIncidents = incidents.filter((i) => new Date(i.incident_date) >= periodStart);

  // KPIs
  const totalRevenue = filteredBookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + (b.total_price || 0), 0);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncidentCost = filteredIncidents.reduce((sum, i) => sum + (i.actual_cost || 0), 0);
  const totalCosts = totalExpenses + totalIncidentCost;
  const netProfit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Monthly data for charts
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; revenue: number; expenses: number; incidents: number; profit: number }> = {};

    const addMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) {
        map[key] = {
          month: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          revenue: 0, expenses: 0, incidents: 0, profit: 0,
        };
      }
      return key;
    };

    filteredBookings.filter((b) => b.status !== "cancelled").forEach((b) => {
      const key = addMonth(b.created_at);
      map[key].revenue += b.total_price || 0;
    });

    filteredExpenses.forEach((e) => {
      const key = addMonth(e.expense_date);
      map[key].expenses += e.amount;
    });

    filteredIncidents.forEach((i) => {
      const key = addMonth(i.incident_date);
      map[key].incidents += i.actual_cost || 0;
    });

    Object.values(map).forEach((m) => { m.profit = m.revenue - m.expenses - m.incidents; });

    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredBookings, filteredExpenses, filteredIncidents]);

  // Expenses by type
  const expensesByType = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      map[e.type] = (map[e.type] || 0) + e.amount;
    });
    return Object.entries(map)
      .map(([type, amount]) => ({ type: expenseTypeLabels[type] || type, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  // Cash flow (cumulative)
  const cashFlowData = useMemo(() => {
    let cumulative = 0;
    return monthlyData.map((m) => {
      cumulative += m.profit;
      return { ...m, cashFlow: cumulative };
    });
  }, [monthlyData]);

  if (loading) {
    return <FinanceSkeleton />;
  }

  const kpis = [
    { label: "Receita Total", value: totalRevenue, icon: TrendingUp, color: "text-emerald-500", bgColor: "bg-emerald-500/10", arrow: ArrowUpRight },
    { label: "Despesas Totais", value: totalCosts, icon: TrendingDown, color: "text-red-500", bgColor: "bg-red-500/10", arrow: ArrowDownRight },
    { label: "Lucro Líquido", value: netProfit, icon: Wallet, color: netProfit >= 0 ? "text-emerald-500" : "text-red-500", bgColor: netProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10", arrow: netProfit >= 0 ? ArrowUpRight : ArrowDownRight },
    { label: "Margem de Lucro", value: profitMargin, icon: BarChart3, color: profitMargin >= 0 ? "text-primary" : "text-red-500", bgColor: "bg-primary/10", isPercent: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" /> Financeiro
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral da operação</p>
        </div>
        <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/30">
          {(["3m", "6m", "12m", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${period === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p === "all" ? "Tudo" : p.replace("m", " meses")}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                {kpi.arrow && <kpi.arrow className={`h-4 w-4 ${kpi.color}`} />}
              </div>
              <p className={`text-xl font-bold tabular-nums ${kpi.color}`}>
                {(kpi as any).isPercent ? `${kpi.value.toFixed(1)}%` : `$${kpi.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue vs Expenses */}
        <Card className="border-border/30">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Receita vs Despesas</h3>
            {monthlyData.length === 0 ? (
              <EmptyState icon={BarChart3} title="Sem movimentação financeira" description="Os indicadores serão calculados automaticamente conforme reservas e despesas forem registradas." compact />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [`$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, name === "revenue" ? "Receita" : name === "expenses" ? "Despesas" : "Incidentes"]}
                  />
                  <Legend formatter={(v) => v === "revenue" ? "Receita" : v === "expenses" ? "Despesas" : "Incidentes"} />
                  <Bar dataKey="revenue" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="incidents" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Cash Flow */}
        <Card className="border-border/30">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Fluxo de Caixa Acumulado</h3>
            {cashFlowData.length === 0 ? (
              <EmptyState icon={Wallet} title="Sem movimentação financeira" description="Os indicadores serão calculados automaticamente conforme reservas e despesas forem registradas." compact />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => [`$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Caixa Acumulado"]}
                  />
                  <Line type="monotone" dataKey="cashFlow" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profit over time */}
        <Card className="border-border/30 lg:col-span-2">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Lucro Mensal</h3>
            {monthlyData.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Sem movimentação financeira" description="Os indicadores serão calculados automaticamente conforme reservas e despesas forem registradas." compact />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => [`$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Lucro"]}
                  />
                  <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expenses breakdown */}
        <Card className="border-border/30">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Despesas por Categoria</h3>
            {expensesByType.length === 0 ? (
              <EmptyState icon={DollarSign} title="Sem despesas registradas" description="As despesas por categoria aparecerão aqui conforme forem registradas." compact />
            ) : (
              <div className="space-y-3">
                {expensesByType.map((et) => {
                  const pct = totalExpenses > 0 ? (et.amount / totalExpenses) * 100 : 0;
                  return (
                    <div key={et.type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{et.type}</span>
                        <span className="font-semibold text-foreground tabular-nums">${et.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary table */}
      <Card className="border-border/30">
        <CardContent className="p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Resumo do Período</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Reservas</p>
              <p className="text-lg font-bold text-foreground tabular-nums">{filteredBookings.filter((b) => b.status !== "cancelled").length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Canceladas</p>
              <p className="text-lg font-bold text-red-500 tabular-nums">{filteredBookings.filter((b) => b.status === "cancelled").length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Despesas Registradas</p>
              <p className="text-lg font-bold text-foreground tabular-nums">{filteredExpenses.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Incidentes</p>
              <p className="text-lg font-bold text-foreground tabular-nums">{filteredIncidents.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
