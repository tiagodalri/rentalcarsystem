import { useEffect, useState } from "react";
import { FleetReportSkeleton } from "@/components/skeletons/MinorPageSkeletons";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart
} from "recharts";
import { darkTooltipProps } from "@/components/admin/ChartTooltip";
import {
  Loader2, TrendingUp, DollarSign, AlertTriangle, Car, CalendarDays,
  ChevronLeft, ChevronRight, Percent, Shield, Baby, Radio, Users, Sparkles, FileBarChart, CalendarRange, X
} from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO, differenceInDays, startOfDay, endOfDay } from "date-fns";
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

// Sophisticated emerald/teal palette — bold yet refined
const CHART_COLORS = [
  "hsl(160 84% 28%)",  // deep emerald
  "hsl(170 60% 38%)",  // teal-emerald
  "hsl(145 55% 42%)",  // forest
  "hsl(180 45% 35%)",  // deep teal
  "hsl(155 40% 52%)",  // sage
  "hsl(165 70% 30%)",  // jade
  "hsl(140 35% 45%)",  // moss
  "hsl(175 50% 48%)",  // mint-teal
];
const GREEN_PRIMARY = "hsl(160 84% 28%)";
const GREEN_SECONDARY = "hsl(170 60% 38%)";

export default function AdminFleetReport({
  embedded = false,
  monthOverride,
}: { embedded?: boolean; monthOverride?: Date } = {}) {
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [month, setMonth] = useState(startOfMonth(monthOverride ?? new Date()));
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [report, setReport] = useState<VehicleReport[]>([]);

  // Sync with external override (global period filter)
  useEffect(() => {
    if (monthOverride) {
      setMonth(startOfMonth(monthOverride));
      setCustomRange(undefined);
    }
  }, [monthOverride?.getTime()]);

  const usingCustom = !!(customRange?.from && customRange?.to);
  const periodStart = usingCustom ? startOfDay(customRange!.from!) : startOfMonth(month);
  const periodEnd = usingCustom ? endOfDay(customRange!.to!) : endOfMonth(month);
  const monthStart = periodStart;
  const monthEnd = periodEnd;
  const daysInMonth = Math.max(1, differenceInDays(monthEnd, monthStart) + 1);

  useEffect(() => {
    loadData();
  }, [month, customRange?.from?.getTime(), customRange?.to?.getTime()]);

  const loadData = async () => {
    setLoading(true);
    const startStr = format(monthStart, "yyyy-MM-dd");
    const endStr = format(monthEnd, "yyyy-MM-dd");

    const [vRes, bRes, iRes] = await Promise.all([
      supabase.from("vehicles").select("*").is("deleted_at", null),
      supabase.from("bookings").select("*")
        .gte("pickup_date", startStr)
        .lte("pickup_date", endStr),
      supabase.from("vehicle_inspections").select("*")
        .gte("created_at", `${startStr}T00:00:00`)
        .lte("created_at", `${endStr}T23:59:59`),
    ]);

    const vehs = vRes.data || [];
    const allBks = bRes.data || [];
    // Regra unificada: receita/ocupação/contagem NÃO incluem reservas canceladas.
    // Reconhecimento pela data de retirada (pickup_date) — filtro já aplicado no SELECT.
    const bks = allBks.filter((b: any) => b.status !== "cancelled");
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
    setInitialLoad(false);
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

  if (loading && initialLoad) {
    return <FleetReportSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        {!embedded ? (
          <div>
            <h1 className="admin-h1 text-2xl">Relatório Mensal de Frota</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise de desempenho, utilização e avarias
            </p>
          </div>
        ) : <div />}
        {!monthOverride && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!usingCustom && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(subMonths(month, 1))} aria-label="Mês anterior">
                  <ChevronLeft size={16} />
                </Button>
                <span className="text-sm font-medium text-foreground px-3 min-w-[140px] text-center capitalize">
                  {format(month, "MMMM yyyy", { locale: ptBR })}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
                  <ChevronRight size={16} />
                </Button>
              </div>
            )}
            <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={usingCustom ? "default" : "outline"}
                  size="sm"
                  className="h-10 gap-2"
                >
                  <CalendarRange size={16} />
                  {usingCustom
                    ? `${format(customRange!.from!, "dd/MM/yy")} – ${format(customRange!.to!, "dd/MM/yy")}`
                    : "Período personalizado"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(r) => {
                    setCustomRange(r);
                    if (r?.from && r?.to) setRangeOpen(false);
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                  initialFocus
                />
                <div className="flex items-center justify-between gap-2 p-2 border-t border-border">
                  <span className="text-xs text-muted-foreground px-2">
                    Selecione um intervalo
                  </span>
                  {usingCustom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => {
                        setCustomRange(undefined);
                        setRangeOpen(false);
                      }}
                    >
                      <X size={14} /> Limpar
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { Icon: DollarSign, label: usingCustom ? "Receita do Período" : "Receita do Mês", value: `$${totalRevenue.toLocaleString()}`, tone: "primary" as const },
          { Icon: CalendarDays, label: "Reservas", value: String(totalBookings), tone: "primary" as const },
          { Icon: Percent, label: "Ocupação Média", value: `${avgOccupancy}%`, tone: "primary" as const },
          { Icon: AlertTriangle, label: "Avarias", value: String(totalDamages), tone: "destructive" as const },
        ].map(({ Icon, label, value, tone }) => (
          <Card key={label} className="border-border/40 h-full min-h-[72px]">
            <CardContent className="!p-4 h-full min-h-[72px] flex items-center">
              <div className="flex items-center gap-3 w-full min-h-10">
                <div
                  className={`shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
                    tone === "destructive" ? "bg-destructive/10" : "bg-primary/10"
                  }`}
                >
                  <Icon size={18} className={tone === "destructive" ? "text-destructive" : "text-primary"} />
                </div>
                <div className="min-w-0 flex h-10 flex-col justify-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider truncate leading-none">{label}</p>
                  <p className="admin-h1 text-xl tabular-nums leading-none mt-2">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
                    {/* Emerald gradient with subtle depth */}
                    <linearGradient id="emeraldShine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="hsl(160 84% 22%)" />
                      <stop offset="50%"  stopColor="hsl(160 84% 32%)" />
                      <stop offset="100%" stopColor="hsl(170 70% 42%)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} />
                  <Tooltip
                    {...darkTooltipProps}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Receita"]}
                  />
                  <Bar dataKey="revenue" fill="url(#emeraldShine)" radius={[2, 4, 4, 2]} barSize={18} />

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
                  <defs>
                    <linearGradient id="emeraldShineOcc" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="hsl(160 84% 22%)" />
                      <stop offset="50%"  stopColor="hsl(160 84% 32%)" />
                      <stop offset="100%" stopColor="hsl(170 70% 42%)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} />
                  <Tooltip
                    {...darkTooltipProps}
                    formatter={(v: number) => [`${v}%`, "Ocupação"]}
                  />
                  <Bar dataKey="occupancy" fill="url(#emeraldShineOcc)" radius={[2, 4, 4, 2]} barSize={18} />
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

      {/* Addon Revenue Breakdown — full width since Plano card was removed */}
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
            <ResponsiveContainer width="100%" height={addonChartData.length * 44 + 40}>
              <BarChart data={addonChartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="emeraldShineAddon" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="hsl(160 84% 22%)" />
                    <stop offset="50%"  stopColor="hsl(160 84% 32%)" />
                    <stop offset="100%" stopColor="hsl(170 70% 42%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} />
                <Tooltip
                  {...darkTooltipProps}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "Receita"]}
                />
                <Bar dataKey="value" fill="url(#emeraldShineAddon)" radius={[2, 4, 4, 2]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Sparkles} title="Sem receita de opcionais" description="A receita de opcionais aparecerá quando houver reservas com adicionais neste mês." compact />
          )}
        </CardContent>
      </Card>

    </div>
  );
}
