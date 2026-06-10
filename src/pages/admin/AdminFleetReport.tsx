import { useEffect, useState } from "react";
import { FleetReportSkeleton } from "@/components/skeletons/MinorPageSkeletons";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart
} from "recharts";
import { darkTooltipProps } from "@/components/admin/ChartTooltip";
import {
  Loader2, TrendingUp, DollarSign, AlertTriangle, Car, CalendarDays,
  ChevronLeft, ChevronRight, Percent, Shield, Baby, Radio, Users, Sparkles, FileBarChart
} from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { aggregateAddons, calcVehicleOccupancyPct } from "@/lib/fleetMetrics";

type VehicleReport = {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  totalBookings: number;
  totalRevenue: number;
  totalDays: number;
  occupancyPct: number;
  damageCount: number;
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
  "hsl(200 70% 50%)",
  "hsl(120 50% 45%)",
  "hsl(45 90% 50%)",
];

export default function AdminFleetReport({
  embedded = false,
  monthOverride,
}: { embedded?: boolean; monthOverride?: Date } = {}) {
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(startOfMonth(monthOverride ?? new Date()));
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [report, setReport] = useState<VehicleReport[]>([]);

  // Sync with external override (global period filter)
  useEffect(() => {
    if (monthOverride) setMonth(startOfMonth(monthOverride));
  }, [monthOverride?.getTime()]);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;

  useEffect(() => {
    loadData();
  }, [month]);

  const loadData = async () => {
    setLoading(true);
    const startStr = format(monthStart, "yyyy-MM-dd");
    const endStr = format(monthEnd, "yyyy-MM-dd");

    const [vRes, bRes, iRes] = await Promise.all([
      supabase.from("vehicles").select("*"),
      supabase.from("bookings").select("*")
        .gte("pickup_date", startStr)
        .lte("pickup_date", endStr),
      supabase.from("vehicle_inspections").select("*")
        .gte("created_at", `${startStr}T00:00:00`)
        .lte("created_at", `${endStr}T23:59:59`),
    ]);

    const vehs = vRes.data || [];
    const bks = bRes.data || [];
    const insps = iRes.data || [];

    setVehicles(vehs);
    setBookings(bks);
    setInspections(insps);

    // Build per-vehicle report
    const rpt: VehicleReport[] = vehs.map((v) => {
      const vBookings = bks.filter((b: any) => b.vehicle_id === v.id);
      const totalRevenue = vBookings.reduce((s: number, b: any) => s + (Number(b.total_price) || 0), 0);
      const totalDays = vBookings.reduce((s: number, b: any) => {
        const d = differenceInDays(parseISO(b.return_date), parseISO(b.pickup_date));
        return s + Math.max(d, 1);
      }, 0);
      const vInsps = insps.filter((i: any) => {
        const bk = bks.find((b: any) => b.id === i.booking_id);
        return bk?.vehicle_id === v.id;
      });
      const damageCount = vInsps.reduce((s: number, i: any) => {
        const dmgs = Array.isArray(i.damages) ? i.damages : [];
        return s + dmgs.length;
      }, 0);

      return {
        id: v.id,
        name: v.name,
        category: v.category,
        image_url: v.image_url,
        totalBookings: vBookings.length,
        totalRevenue,
        totalDays,
        occupancyPct: Math.min(100, Math.round((totalDays / daysInMonth) * 100)),
        damageCount,
      };
    });

    rpt.sort((a, b) => b.totalRevenue - a.totalRevenue);
    setReport(rpt);
    setLoading(false);
  };

  // Aggregated metrics
  const totalRevenue = report.reduce((s, r) => s + r.totalRevenue, 0);
  const totalBookings = bookings.length;
  const avgOccupancy = report.length ? Math.round(report.reduce((s, r) => s + r.occupancyPct, 0) / report.length) : 0;
  const totalDamages = report.reduce((s, r) => s + r.damageCount, 0);

  // Chart data
  const revenueChartData = report
    .filter((r) => r.totalRevenue > 0)
    .slice(0, 10)
    .map((r) => ({ name: r.name, revenue: r.totalRevenue }));

  const occupancyChartData = report
    .filter((r) => r.totalBookings > 0)
    .slice(0, 10)
    .map((r) => ({ name: r.name, occupancy: r.occupancyPct }));

  const categoryData = Object.entries(
    report.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + r.totalRevenue;
      return acc;
    }, {} as Record<string, number>)
  )
    .filter(([_, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const damageRanking = [...report].filter((r) => r.damageCount > 0).sort((a, b) => b.damageCount - a.damageCount).slice(0, 10);

  // Addon revenue calculations
  const _addons = aggregateAddons(bookings as any);
  const addonTotals = {
    planExtra: _addons.plan_extra,
    insurance: _addons.insurance_total,
    childSeat: _addons.child_seat_total,
    tollTag: _addons.toll_tag_total,
    extraDriver: _addons.extra_driver_total,
    returnFee: _addons.return_fee,
  };

  const addonChartData = [
    { name: "Upgrade de Plano", value: addonTotals.planExtra, icon: "✨" },
    { name: "Seguro Premium", value: addonTotals.insurance, icon: "🛡" },
    { name: "Cadeirinha Infantil", value: addonTotals.childSeat, icon: "👶" },
    { name: "TAG Pedágio", value: addonTotals.tollTag, icon: "📡" },
    { name: "Condutor Extra", value: addonTotals.extraDriver, icon: "👥" },
    { name: "Taxa One-Way", value: addonTotals.returnFee, icon: "🔄" },
  ].filter((d) => d.value > 0);

  const totalAddonRevenue = addonChartData.reduce((s, d) => s + d.value, 0);

  // Plan distribution (single plan)
  const totalBookingsWithPlan = bookings.length;

  if (loading) {
    return <FleetReportSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        {!embedded ? (
          <div>
            <h1 className="text-2xl font-medium text-foreground">Relatório Mensal de Frota</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise de desempenho, utilização e avarias
            </p>
          </div>
        ) : <div />}
        {!monthOverride && (
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(subMonths(month, 1))}>
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-medium text-foreground px-3 min-w-[140px] text-center capitalize">
              {format(month, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Receita Total</p>
                <p className="text-xl font-medium text-foreground">${totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarDays size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Reservas</p>
                <p className="text-xl font-medium text-foreground">{totalBookings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Percent size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Ocupação Média</p>
                <p className="text-xl font-medium text-foreground">{avgOccupancy}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Avarias</p>
                <p className="text-xl font-medium text-foreground">{totalDamages}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue per vehicle */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" /> Receita por Veículo (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={revenueChartData.length * 40 + 40}>
                <BarChart data={revenueChartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                  <defs>
                    {/* Metallic gold with reflective sheen (horizontal bars) */}
                    <linearGradient id="goldShine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#6b4a16" />
                      <stop offset="18%"  stopColor="#a07a2a" />
                      <stop offset="42%"  stopColor="#e7c873" />
                      <stop offset="55%"  stopColor="#fff2c2" />
                      <stop offset="68%"  stopColor="#e7c873" />
                      <stop offset="88%"  stopColor="#a07a2a" />
                      <stop offset="100%" stopColor="#6b4a16" />
                    </linearGradient>
                    {/* Soft top-edge highlight to simulate brushed-metal curvature */}
                    <linearGradient id="goldEdge" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="rgba(255,255,255,0.28)" />
                      <stop offset="35%"  stopColor="rgba(255,255,255,0)" />
                      <stop offset="65%"  stopColor="rgba(0,0,0,0)" />
                      <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} />
                  <Tooltip
                    {...darkTooltipProps}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Receita"]}
                  />
                  <Bar dataKey="revenue" fill="url(#goldShine)" radius={[2, 4, 4, 2]} barSize={22} />
                  <Bar dataKey="revenue" fill="url(#goldEdge)" radius={[2, 4, 4, 2]} barSize={22} stackId="overlay" legendType="none" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={TrendingUp} title="Sem dados de receita" description="Os dados de receita por veículo aparecerão quando houver reservas neste mês." compact />
            )}
          </CardContent>
        </Card>

        {/* Occupancy per vehicle */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Car size={16} className="text-primary" /> Taxa de Ocupação (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {occupancyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={occupancyChartData.length * 40 + 40}>
                <BarChart data={occupancyChartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} />
                  <Tooltip
                    {...darkTooltipProps}
                    formatter={(v: number) => [`${v}%`, "Ocupação"]}
                  />
                  <Bar dataKey="occupancy" fill="hsl(var(--chart-2, 160 60% 45%))" radius={[0, 4, 4, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={Percent} title="Sem dados de ocupação" description="Os dados de ocupação por veículo aparecerão quando houver reservas neste mês." compact />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by category */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign size={16} className="text-primary" /> Receita por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...darkTooltipProps}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Receita"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={DollarSign} title="Sem dados de receita" description="A receita por categoria aparecerá quando houver reservas neste mês." compact />
            )}
          </CardContent>
        </Card>

        {/* Damage ranking */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle size={16} className="text-destructive" /> Ranking de Avarias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {damageRanking.length > 0 ? (
              <div className="space-y-2">
                {damageRanking.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/20">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      i === 0 ? "bg-destructive/20 text-destructive" : i < 3 ? "bg-muted text-foreground" : "bg-muted/50 text-muted-foreground"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">{r.category}</p>
                    </div>
                    <Badge variant="outline" className="border-destructive/30 text-destructive text-xs">
                      {r.damageCount} avaria{r.damageCount > 1 ? "s" : ""}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={AlertTriangle} title="Nenhuma avaria registrada" description="As avarias por veículo aparecerão aqui quando forem registradas nas inspeções." compact />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 — Addon Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Addon Revenue Breakdown */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-primary" /> Receita de Opcionais
              {totalAddonRevenue > 0 && (
                <Badge variant="outline" className="ml-auto text-xs font-medium">${totalAddonRevenue.toLocaleString()}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {addonChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={addonChartData.length * 50 + 40}>
                <BarChart data={addonChartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} />
                  <Tooltip
                    {...darkTooltipProps}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Receita"]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {addonChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={Sparkles} title="Sem receita de opcionais" description="A receita de opcionais aparecerá quando houver reservas com adicionais neste mês." compact />
            )}
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield size={16} className="text-primary" /> Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalBookingsWithPlan > 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield size={28} className="text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Zeus</p>
                  <p className="text-[11px] text-muted-foreground">Plano único</p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full mt-1">
                  <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/20">
                    <p className="text-[10px] text-muted-foreground">Reservas</p>
                    <p className="text-sm font-medium text-foreground">{totalBookingsWithPlan}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/20">
                    <p className="text-[10px] text-muted-foreground">% do total</p>
                    <p className="text-sm font-medium text-foreground">100%</p>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState icon={Shield} title="Sem dados" description="Os dados do plano aparecerão quando houver reservas neste mês." compact />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Addon KPI Cards */}
      {totalAddonRevenue > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Upgrade Plano", value: addonTotals.planExtra, icon: Sparkles },
            { label: "Seguro Premium", value: addonTotals.insurance, icon: Shield },
            { label: "Cadeirinha", value: addonTotals.childSeat, icon: Baby },
            { label: "TAG Pedágio", value: addonTotals.tollTag, icon: Radio },
            { label: "Condutor Extra", value: addonTotals.extraDriver, icon: Users },
            { label: "Taxa One-Way", value: addonTotals.returnFee, icon: Car },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border-border/40">
              <CardContent className="p-3 text-center">
                <Icon size={16} className="text-primary mx-auto mb-1" />
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-base font-medium text-foreground">${value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Full vehicle table */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Desempenho Completo da Frota</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="text-left py-2 pr-4">Veículo</th>
                  <th className="text-left py-2 pr-4">Categoria</th>
                  <th className="text-right py-2 pr-4">Reservas</th>
                  <th className="text-right py-2 pr-4">Dias Locados</th>
                  <th className="text-right py-2 pr-4">Ocupação</th>
                  <th className="text-right py-2 pr-4">Receita</th>
                  <th className="text-right py-2">Avarias</th>
                </tr>
              </thead>
              <tbody>
                {report.map((r) => (
                  <tr key={r.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="py-2 pr-4 font-medium text-foreground">{r.name}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.category}</td>
                    <td className="py-2 pr-4 text-right text-foreground">{r.totalBookings}</td>
                    <td className="py-2 pr-4 text-right text-foreground">{r.totalDays}</td>
                    <td className="py-2 pr-4 text-right">
                      <span className={r.occupancyPct >= 70 ? "text-emerald-600 font-medium" : r.occupancyPct >= 40 ? "text-foreground" : "text-muted-foreground"}>
                        {r.occupancyPct}%
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-foreground">${r.totalRevenue.toLocaleString()}</td>
                    <td className="py-2 text-right">
                      {r.damageCount > 0 ? (
                        <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">{r.damageCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
