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
  ChevronLeft, ChevronRight, Percent, Shield, Baby, Radio, Users, User, Sparkles, FileBarChart, CalendarRange, X
} from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import DonutChart from "@/components/admin/DonutChart";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO, differenceInDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { aggregateAddons, calcVehicleOccupancyPct } from "@/lib/fleetMetrics";
import { getVehicleDisplayName, detectVehicleColor, detectVehicleColorName } from "@/lib/vehicleDisplay";

// Custom YAxis tick: colored dot + single-line vehicle name + tooltip
const VehicleTick = (props: any) => {
  const { x, y, payload, colorMap, colorNameMap } = props;
  const label: string = payload?.value ?? "";
  const dotColor: string = (colorMap && colorMap[label]) || "hsl(var(--muted-foreground))";
  const colorName: string | undefined = colorNameMap?.[label];
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Larger invisible hit-area for mobile long-press */}
      <circle cx={-10} cy={0} r={12} fill="transparent" />
      <circle cx={-10} cy={0} r={6} fill={dotColor} stroke="hsl(var(--border))" strokeWidth={1} />
      {colorName && <title>Cor: {colorName}</title>}
      <text x={-24} y={0} dy={4} textAnchor="end" fontSize={11} fill="hsl(var(--muted-foreground))">
        {label}
      </text>
    </g>
  );
};


type VehicleReport = {
  id: string;
  name: string;
  color: string | null;
  colorName: string | null;
  category: string;
  image_url: string | null;
  totalBookings: number;
  totalRevenue: number;
  totalDays: number;
  occupancyPct: number;
  damageCount: number;
  listedOnTuro: boolean;
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

// Private-bank inspired palette for category donut — gold, slate, petrol, warm accents
const CATEGORY_PALETTE = [
  "hsl(45 79% 56%)",   // gold primary
  "hsl(220 14% 35%)",  // slate
  "hsl(175 60% 38%)",  // petrol teal
  "hsl(12 65% 52%)",   // terracotta
  "hsl(270 30% 48%)",  // muted lavender
  "hsl(145 50% 36%)",  // forest green
  "hsl(210 55% 48%)",  // steel blue
  "hsl(35 50% 55%)",   // warm sand
];

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
  const [turoFilter, setTuroFilter] = useState<"all" | "listed" | "unlisted">("all");

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
  const periodStartMs = monthStart.getTime();
  const periodEndMs = monthEnd.getTime() + 24 * 60 * 60 * 1000;

  useEffect(() => {
    loadData();
  }, [month, customRange?.from?.getTime(), customRange?.to?.getTime()]);

  const loadData = async () => {
    setLoading(true);
    const startStr = format(monthStart, "yyyy-MM-dd");
    const endStr = format(monthEnd, "yyyy-MM-dd");

    const [vRes, bRes, iRes] = await Promise.all([
      supabase.from("vehicles").select("*").is("deleted_at", null),
      // Buscar reservas que SE SOBREPÕEM ao período (não apenas pickup dentro do mês)
      supabase.from("bookings").select("*")
        .is("deleted_at", null)
        .lte("pickup_date", endStr)
        .gte("return_date", startStr),
      supabase.from("vehicle_inspections").select("*")
        .gte("created_at", `${startStr}T00:00:00`)
        .lte("created_at", `${endStr}T23:59:59`),
    ]);

    const vehs = vRes.data || [];
    const allBks = bRes.data || [];
    // Regra unificada: receita/ocupação/contagem NÃO incluem reservas canceladas.
    const bks = allBks.filter((b: any) => b.status !== "cancelled");
    const insps = iRes.data || [];

    setVehicles(vehs);
    setBookings(bks);
    setInspections(insps);

    // Janela do período em ms (return é exclusivo: [pickup, return))
    const periodStartMs = monthStart.getTime();
    const periodEndMs = monthEnd.getTime() + 24 * 60 * 60 * 1000; // fim do dia final
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    // Build per-vehicle report
    const rpt: VehicleReport[] = vehs.map((v) => {
      const vBookings = bks.filter((b: any) => b.vehicle_id === v.id);
      // Receita: apenas reservas que retiraram dentro do período (reconhecimento na retirada)
      const revenueBookings = vBookings.filter((b: any) => {
        const p = parseISO(b.pickup_date).getTime();
        return p >= periodStartMs && p < periodEndMs;
      });
      const totalRevenue = revenueBookings.reduce((s: number, b: any) => s + (Number(b.total_price) || 0), 0);
      // Dias ocupados: interseção [pickup, return) ∩ [monthStart, monthEnd+1)
      const totalDays = vBookings.reduce((s: number, b: any) => {
        const pickupMs = parseISO(b.pickup_date).getTime();
        const returnMs = parseISO(b.return_date).getTime();
        const start = Math.max(pickupMs, periodStartMs);
        const end = Math.min(returnMs, periodEndMs);
        const days = Math.max(0, (end - start) / MS_PER_DAY);
        return s + days;
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
        name: getVehicleDisplayName(v),
        color: detectVehicleColor(v),
        colorName: detectVehicleColorName(v),
        category: v.category,
        image_url: v.image_url,
        totalBookings: revenueBookings.length,
        totalRevenue,
        totalDays: Math.round(totalDays * 10) / 10,
        occupancyPct: Math.min(100, Math.round((totalDays / daysInMonth) * 100)),
        damageCount,
        listedOnTuro: !!v.listed_on_turo,
      };
    });


    rpt.sort((a, b) => b.totalRevenue - a.totalRevenue);
    setReport(rpt);
    setLoading(false);
    setInitialLoad(false);
  };

  // Apply Turo filter to derived report views
  const visibleReport = report.filter((r) => {
    if (turoFilter === "listed") return r.listedOnTuro;
    if (turoFilter === "unlisted") return !r.listedOnTuro;
    return true;
  });

  // Aggregated metrics
  const totalRevenue = visibleReport.reduce((s, r) => s + r.totalRevenue, 0);
  const totalBookings = bookings.filter((b) => {
    if (turoFilter === "all") return true;
    const v = vehicles.find((x: any) => x.id === b.vehicle_id);
    return turoFilter === "listed" ? !!v?.listed_on_turo : !v?.listed_on_turo;
  }).length;
  const avgOccupancy = visibleReport.length ? Math.round(visibleReport.reduce((s, r) => s + r.occupancyPct, 0) / visibleReport.length) : 0;

  // Revenue by channel (revenue recognition by pickup date, excluding cancelled)
  const channelRevenue = (predicate: (b: any) => boolean) => {
    return bookings
      .filter((b) => {
        if (!predicate(b)) return false;
        const p = parseISO(b.pickup_date).getTime();
        return p >= periodStartMs && p < periodEndMs;
      })
      .reduce((s, b) => s + (Number(b.total_price) || 0), 0);
  };

  const turoRevenue = channelRevenue((b) => !!b.turo_reservation_code);
  const partnerRevenue = channelRevenue((b) => !!b.partner_id && !b.turo_reservation_code);
  const directRevenue = channelRevenue((b) => !b.turo_reservation_code && !b.partner_id);

  // Chart data
  const revenueChartData = visibleReport
    .filter((r) => r.totalRevenue > 0)
    .map((r) => ({ name: r.name, revenue: r.totalRevenue }));

  const occupancyChartData = visibleReport
    .filter((r) => r.totalBookings > 0)
    .map((r) => ({ name: r.name, occupancy: r.occupancyPct }));

  // Color map: vehicle display-name -> real vehicle color (for chart ticks)
  const vehicleColorMap: Record<string, string> = visibleReport.reduce((acc, r) => {
    if (r.color) acc[r.name] = r.color;
    return acc;
  }, {} as Record<string, string>);

  const vehicleColorNameMap: Record<string, string> = visibleReport.reduce((acc, r) => {
    if (r.colorName) acc[r.name] = r.colorName;
    return acc;
  }, {} as Record<string, string>);


  const categoryData = Object.entries(
    visibleReport.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + r.totalRevenue;
      return acc;
    }, {} as Record<string, number>)
  )
    .filter(([_, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const damageRanking = [...visibleReport].filter((r) => r.damageCount > 0).sort((a, b) => b.damageCount - a.damageCount).slice(0, 10);

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
                    ? `${format(customRange!.from!, "dd/MM/yy")}. ${format(customRange!.to!, "dd/MM/yy")}`
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
            <select
              value={turoFilter}
              onChange={(e) => setTuroFilter(e.target.value as any)}
              className="h-10 rounded-md border border-border bg-background px-2 text-sm"
              title="Filtrar por listagem na Turo"
            >
              <option value="listed">Turo</option>
              <option value="unlisted">Particular</option>
              <option value="all">Todos</option>
            </select>
          </div>
        )}
      </div>

      {/* KPI Cards — row 1: core metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { Icon: DollarSign, label: usingCustom ? "Receita do Período" : "Receita do Mês", value: `$${totalRevenue.toLocaleString()}` },
          { Icon: CalendarDays, label: "Reservas", value: String(totalBookings) },
          { Icon: Percent, label: "Ocupação Média", value: `${avgOccupancy}%` },
        ].map(({ Icon, label, value }) => (
          <Card key={label} className="border-border/40 h-full">
            <CardContent className="!p-4 h-full flex items-center">
              <div className="flex items-center gap-3.5 w-full">
                <div className="shrink-0 h-11 w-11 rounded-xl flex items-center justify-center bg-primary/[0.07]">
                  <Icon size={20} strokeWidth={1.8} className="text-primary" />
                </div>
                <div className="min-w-0 flex flex-col justify-center gap-1">
                  <p className="text-[11px] text-muted-foreground/80 uppercase tracking-[0.12em] truncate leading-none">{label}</p>
                  <p className="admin-h1 text-[22px] tabular-nums leading-none">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPI Cards — row 2: revenue by channel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { Logo: TuroLogo, label: "Turo", value: `$${turoRevenue.toLocaleString()}` },
          { Logo: ParceirosLogo, label: "Parceiros", value: `$${partnerRevenue.toLocaleString()}` },
          { Logo: ParticularesLogo, label: "Particulares", value: `$${directRevenue.toLocaleString()}` },
        ].map(({ Logo, label, value }) => (
          <Card key={label} className="border-border/40 h-full">
            <CardContent className="!p-4 h-full flex items-center">
              <div className="flex items-center gap-3.5 w-full">
                <Logo size={44} className="shrink-0" />
                <div className="min-w-0 flex flex-col justify-center gap-1">
                  <p className="text-[11px] text-muted-foreground/80 uppercase tracking-[0.12em] truncate leading-none">{label}</p>
                  <p className="admin-h1 text-[22px] tabular-nums leading-none">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/70 -mt-2 flex items-center gap-1.5">
        <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/40" />
        Receita reconhecida pela data de retirada (pickup) e exclui reservas canceladas.
      </p>


      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue per vehicle */}
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-medium flex items-center gap-2 tracking-tight">
              <div className="h-6 w-6 rounded-md bg-primary/[0.07] flex items-center justify-center">
                <TrendingUp size={14} className="text-primary" />
              </div>
              Receita por Veículo
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
                  <YAxis type="category" dataKey="name" width={190} interval={0} tickLine={false} tick={<VehicleTick colorMap={vehicleColorMap} colorNameMap={vehicleColorNameMap} />} />

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
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-medium flex items-center gap-2 tracking-tight">
              <div className="h-6 w-6 rounded-md bg-primary/[0.07] flex items-center justify-center">
                <Car size={14} className="text-primary" />
              </div>
              Taxa de Ocupação
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
                  <YAxis type="category" dataKey="name" width={190} interval={0} tickLine={false} tick={<VehicleTick colorMap={vehicleColorMap} colorNameMap={vehicleColorNameMap} />} />

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
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-medium flex items-center gap-2 tracking-tight">
              <div className="h-6 w-6 rounded-md bg-primary/[0.07] flex items-center justify-center">
                <DollarSign size={14} className="text-primary" />
              </div>
              Receita por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <DonutChart
                title="Total"
                data={categoryData.map((d, i) => ({
                  name: d.name,
                  value: d.value,
                  color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
                }))}
              />
            ) : (
              <EmptyState icon={DollarSign} title="Sem dados de receita" description="A receita por categoria aparecerá quando houver reservas neste mês." compact />
            )}
          </CardContent>
        </Card>

        {/* Damage ranking */}
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-medium flex items-center gap-2 tracking-tight">
              <div className="h-6 w-6 rounded-md bg-destructive/10 flex items-center justify-center">
                <AlertTriangle size={14} className="text-destructive" />
              </div>
              Ranking de Avarias
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

      {/* Addon Revenue Breakdown. full width since Plano card was removed */}
      <Card className="border-border/40">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-medium flex items-center gap-2 tracking-tight">
              <div className="h-6 w-6 rounded-md bg-primary/[0.07] flex items-center justify-center">
                <Sparkles size={14} className="text-primary" />
              </div>
              Receita de Opcionais
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
