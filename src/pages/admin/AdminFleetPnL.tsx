import { useEffect, useMemo, useState } from "react";
import { FleetPnLSkeleton } from "@/components/skeletons/MinorPageSkeletons";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, DollarSign, Car, Search, Percent, Clock, GitCompare, X } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { format, parseISO, differenceInDays, differenceInMonths, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calcRoiPct, vehicleRevenueBreakdown, sumVehicleExpenses } from "@/lib/fleetMetrics";

type Row = {
  id: string;
  name: string;
  category: string;
  status: string;
  acquired_date: string | null;
  purchase_price: number;
  bookings: number;
  rentalRevenue: number;
  addonRevenue: number;
  totalRevenue: number;
  expenses: number;
  operatingProfit: number;
  roiPct: number | null;
  paidOff: boolean;
  daysOwned: number;
  totalDays: number;
  occupancyPct: number;
  damageCount: number;
  listedOnTuro: boolean;
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function AdminFleetPnL({ embedded = false }: { embedded?: boolean } = {}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof Row>("operatingProfit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [avgMonthlyRevenue3m, setAvgMonthlyRevenue3m] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [turoFilter, setTuroFilter] = useState<"all" | "listed" | "unlisted">("all");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [vRes, bRes, eRes, iRes] = await Promise.all([
      supabase.from("vehicles").select("*").is("deleted_at", null),
      supabase.from("bookings").select("*").is("deleted_at", null),
      supabase.from("vehicle_expenses").select("*"),
      supabase.from("vehicle_inspections").select("*"),
    ]);

    const isTest = (v: any) => {
      const n = (v?.name || "").toLowerCase();
      const s = (v?.status || "").toLowerCase();
      return s === "test" || s === "archived" || s === "sold" || /\bteste?\b/.test(n);
    };
    const vehs = (vRes.data || []).filter((v: any) => !isTest(v));
    const validIds = new Set(vehs.map((v: any) => v.id));
    const bks = (bRes.data || []).filter((b: any) => !b.vehicle_id || validIds.has(b.vehicle_id));
    const exps = (eRes.data || []).filter((e: any) => !e.vehicle_id || validIds.has(e.vehicle_id));
    const insps = (iRes.data || []);

    const today = new Date();

    // Calculate average monthly revenue over last 3 months
    const threeMonthsAgo = startOfMonth(subMonths(today, 3));
    const revenueByMonth = new Map<string, number>();
    bks.forEach((b: any) => {
      const pd = parseISO(b.pickup_date);
      if (pd >= threeMonthsAgo) {
        const key = format(pd, "yyyy-MM");
        revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + (Number(b.total_price) || 0));
      }
    });
    const monthlyValues = Array.from(revenueByMonth.values());
    const avg3m = monthlyValues.length > 0
      ? monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length
      : null;
    setAvgMonthlyRevenue3m(avg3m);

    const result: Row[] = vehs.map((v: any) => {
      const vBookings = bks.filter((b: any) => b.vehicle_id === v.id);
      const { rentalRevenue, addonRevenue, totalRevenue } = vehicleRevenueBreakdown(v, vBookings);
      const expenses = sumVehicleExpenses(v.id, exps);
      const purchasePrice = Number(v.purchase_price) || 0;
      const operatingProfit = totalRevenue - expenses;
      const roiPct = calcRoiPct(totalRevenue, expenses, purchasePrice);
      const paidOff = operatingProfit >= purchasePrice && purchasePrice > 0;

      const daysOwned = v.acquired_date
        ? Math.max(differenceInDays(today, parseISO(v.acquired_date)), 1)
        : 0;

      // Total rented days (lifetime): only the overlap between booking period
      // and the ownership window [acquired_date, today]. Skip cancelled bookings.
      const acquired = v.acquired_date ? parseISO(v.acquired_date) : null;
      const totalDays = vBookings.reduce((s: number, b: any) => {
        if ((b.status || "").toLowerCase() === "cancelled") return s;
        try {
          const pickup = parseISO(b.pickup_date);
          const ret = parseISO(b.return_date);
          // Clip to ownership window
          const start = acquired && pickup < acquired ? acquired : pickup;
          const end = ret > today ? today : ret;
          const d = differenceInDays(end, start);
          if (d <= 0) return s;
          return s + d;
        } catch {
          return s;
        }
      }, 0);
      const occupancyPct = daysOwned > 0
        ? Math.min(100, Math.round((totalDays / daysOwned) * 100))
        : 0;

      // Damages from inspections (lifetime)
      const bookingIds = new Set(vBookings.map((b: any) => b.id));
      const vInsps = insps.filter((i: any) => bookingIds.has(i.booking_id));
      const damageCount = vInsps.reduce((s: number, i: any) => {
        const dmgs = Array.isArray(i.damages) ? i.damages : [];
        return s + dmgs.length;
      }, 0);

      return {
        id: v.id,
        name: v.name,
        category: v.category,
        status: v.status,
        acquired_date: v.acquired_date,
        purchase_price: purchasePrice,
        bookings: vBookings.length,
        rentalRevenue,
        addonRevenue,
        totalRevenue,
        expenses,
        operatingProfit,
        roiPct,
        paidOff,
        daysOwned,
        totalDays,
        occupancyPct,
        damageCount,
        listedOnTuro: !!v.listed_on_turo,
      };
    });

    setRows(result);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = rows.filter((r) => {
      if (turoFilter === "listed" && !r.listedOnTuro) return false;
      if (turoFilter === "unlisted" && r.listedOnTuro) return false;
      return r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
    });
    return list.sort((a, b) => {
      const av = (a[sortKey] ?? -Infinity) as any;
      const bv = (b[sortKey] ?? -Infinity) as any;
      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, search, sortKey, sortDir, turoFilter]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.purchase += r.purchase_price;
        acc.revenue += r.totalRevenue;
        acc.expenses += r.expenses;
        acc.opProfit += r.operatingProfit;
        return acc;
      },
      { purchase: 0, revenue: 0, expenses: 0, opProfit: 0 }
    );
  }, [rows]);

  const globalRoiPct = totals.purchase > 0
    ? Math.round(((totals.revenue - totals.expenses - totals.purchase) / totals.purchase) * 1000) / 10
    : null;

  const paybackMonths = useMemo(() => {
    if (!avgMonthlyRevenue3m || avgMonthlyRevenue3m <= 0) return null;
    const remaining = totals.purchase - (totals.revenue - totals.expenses);
    if (remaining <= 0) return "recovered" as const;
    return Math.ceil(remaining / avgMonthlyRevenue3m);
  }, [totals, avgMonthlyRevenue3m]);

  const toggleSort = (key: keyof Row) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (loading) {
    return <FleetPnLSkeleton />;
  }

  const TH = ({ k, children, align = "right" }: { k: keyof Row; children: React.ReactNode; align?: "left" | "right" }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
      {sortKey === k && <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        {!embedded ? (
          <div>
            <h1 className="admin-h1 text-2xl">Relatório de Frota. Lucro por Veículo</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Compra, gastos, receitas e lucro operacional de cada carro desde a aquisição
            </p>
          </div>
        ) : <div />}
        <button
          onClick={() => { setCompareMode(!compareMode); if (compareMode) setCompareIds([]); }}
          className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg border text-xs font-medium uppercase tracking-wider transition-colors ${
            compareMode
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-foreground border-border/40 hover:bg-muted"
          }`}
        >
          <GitCompare size={13} />
          {compareMode ? `Comparando (${compareIds.length})` : "Comparar veículos"}
        </button>
      </div>

      {/* Comparator panel */}
      {compareMode && compareIds.length >= 2 && (() => {
        const selected = rows.filter(r => compareIds.includes(r.id));
        const metrics: { key: keyof Row | "margin"; label: string; format: (v: any) => string; better?: "high" | "low" }[] = [
          { key: "purchase_price", label: "Valor pago", format: (v) => `$${fmt(v)}`, better: "low" },
          { key: "bookings", label: "Locações", format: (v) => String(v), better: "high" },
          { key: "totalRevenue", label: "Receita total", format: (v) => `$${fmt(v)}`, better: "high" },
          { key: "expenses", label: "Gastos", format: (v) => `$${fmt(v)}`, better: "low" },
          { key: "operatingProfit", label: "Lucro operacional", format: (v) => `${v >= 0 ? "" : "-"}$${fmt(Math.abs(v))}`, better: "high" },
          { key: "roiPct", label: "ROI %", format: (v) => v === null ? "" : `${v.toFixed(1)}%`, better: "high" },
          { key: "daysOwned", label: "Dias na frota", format: (v) => String(v), better: "high" },
        ];

        const winners: Record<string, string | null> = {};
        metrics.forEach(m => {
          if (!m.better) return;
          const vals = selected.map(s => ({ id: s.id, v: (s as any)[m.key] }));
          const valid = vals.filter(x => x.v !== null && x.v !== undefined && !isNaN(Number(x.v)));
          if (valid.length === 0) { winners[m.key as string] = null; return; }
          const winner = m.better === "high"
            ? valid.reduce((a, b) => Number(b.v) > Number(a.v) ? b : a)
            : valid.reduce((a, b) => Number(b.v) < Number(a.v) ? b : a);
          winners[m.key as string] = winner.id;
        });

        return (
          <Card className="border-primary/30 bg-primary/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitCompare size={14} className="text-primary" />
                  Comparação ({selected.length} veículos)
                </CardTitle>
                <button
                  onClick={() => setCompareIds([])}
                  className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wider font-semibold"
                >
                  Limpar
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-y border-border/40">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Métrica</th>
                    {selected.map(v => (
                      <th key={v.id} className="px-4 py-2 text-right text-[11px] font-semibold text-foreground">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="truncate max-w-[160px]">{v.name}</span>
                          <button
                            onClick={() => setCompareIds(compareIds.filter(id => id !== v.id))}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X size={11} />
                          </button>
                        </div>
                        <div className="text-[9px] font-normal text-muted-foreground mt-0.5">{v.category}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(m => (
                    <tr key={m.key as string} className="border-b border-border/20">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-medium">{m.label}</td>
                      {selected.map(v => {
                        const val = (v as any)[m.key];
                        const isWinner = winners[m.key as string] === v.id && selected.length > 1;
                        return (
                          <td key={v.id} className={`px-4 py-2.5 text-right text-xs tabular-nums font-semibold ${isWinner ? "text-emerald-500" : "text-foreground"}`}>
                            {m.format(val)}
                            {isWinner && <span className="ml-1 text-[9px] uppercase">★</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })()}

      {/* KPI cards. 3 cols desktop, 2 cols tablet, 1 col mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Investimento */}
        <Card className="border-border/40">
          <CardContent className="!p-4 h-full flex items-center">
            <div className="flex items-center gap-3.5 w-full">
              <div className="shrink-0 h-11 w-11 rounded-xl bg-muted flex items-center justify-center">
                <Car size={20} strokeWidth={1.8} className="text-foreground" />
              </div>
              <div className="min-w-0 flex flex-col justify-center gap-1">
                <p className="text-[11px] text-muted-foreground/80 uppercase tracking-[0.12em] truncate leading-none">Investimento</p>
                <p className="admin-h1 text-[22px] tabular-nums leading-none">${fmt(totals.purchase)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Receita Total */}
        <Card className="border-border/40">
          <CardContent className="!p-4 h-full flex items-center">
            <div className="flex items-center gap-3.5 w-full">
              <div className="shrink-0 h-11 w-11 rounded-xl bg-primary/[0.07] flex items-center justify-center">
                <DollarSign size={20} strokeWidth={1.8} className="text-primary" />
              </div>
              <div className="min-w-0 flex flex-col justify-center gap-1">
                <p className="text-[11px] text-muted-foreground/80 uppercase tracking-[0.12em] truncate leading-none">Receita Acumulada</p>
                <p className="admin-h1 text-[22px] tabular-nums leading-none">${fmt(totals.revenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Gastos Totais */}
        <Card className="border-border/40">
          <CardContent className="!p-4 h-full flex items-center">
            <div className="flex items-center gap-3.5 w-full">
              <div className="shrink-0 h-11 w-11 rounded-xl bg-destructive/10 flex items-center justify-center">
                <TrendingDown size={20} strokeWidth={1.8} className="text-destructive" />
              </div>
              <div className="min-w-0 flex flex-col justify-center gap-1">
                <p className="text-[11px] text-muted-foreground/80 uppercase tracking-[0.12em] truncate leading-none">Gastos Totais</p>
                <p className="admin-h1 text-[22px] tabular-nums leading-none">${fmt(totals.expenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Lucro Operacional */}
        <Card className="border-border/40">
          <CardContent className="!p-4 h-full flex items-center">
            <div className="flex items-center gap-3.5 w-full">
              <div className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${totals.opProfit >= 0 ? "bg-emerald-700/10" : "bg-destructive/10"}`}>
                <TrendingUp size={20} strokeWidth={1.8} className={totals.opProfit >= 0 ? "text-emerald-700" : "text-destructive"} />
              </div>
              <div className="min-w-0 flex flex-col justify-center gap-1">
                <p className="text-[11px] text-muted-foreground/80 uppercase tracking-[0.12em] truncate leading-none">Lucro Operacional</p>
                <p className={`text-[22px] font-medium tabular-nums leading-none ${totals.opProfit >= 0 ? "text-emerald-700" : "text-destructive"}`}>
                  {totals.opProfit >= 0 ? "" : "-"}${fmt(Math.abs(totals.opProfit))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. ROI */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="border-border/40 cursor-help">
              <CardContent className="!p-4 h-full flex items-center">
                <div className="flex items-center gap-3.5 w-full">
                  <div className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${(globalRoiPct ?? 0) >= 0 ? "bg-emerald-700/10" : "bg-destructive/10"}`}>
                    <Percent size={20} strokeWidth={1.8} className={(globalRoiPct ?? 0) >= 0 ? "text-emerald-700" : "text-destructive"} />
                  </div>
                  <div className="min-w-0 flex flex-col justify-center gap-1">
                    <p className="text-[11px] text-muted-foreground/80 uppercase tracking-[0.12em] truncate leading-none">Retorno sobre Investimento</p>
                    <p className={`text-[22px] font-medium tabular-nums leading-none ${globalRoiPct === null ? "text-muted-foreground" : (globalRoiPct >= 0 ? "text-emerald-700" : "text-destructive")}`}>
                      {globalRoiPct === null ? "" : `${globalRoiPct.toFixed(1)}%`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px]">
            <p className="text-xs">Quanto foi recuperado do investimento total na frota</p>
          </TooltipContent>
        </Tooltip>

        {/* 6. Payback Estimado */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="border-border/40 cursor-help">
              <CardContent className="!p-4 h-full flex items-center">
                <div className="flex items-center gap-3.5 w-full">
                  <div className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${paybackMonths === "recovered" ? "bg-emerald-700/10" : "bg-muted"}`}>
                    <Clock size={20} strokeWidth={1.8} className={paybackMonths === "recovered" ? "text-emerald-700" : "text-foreground"} />
                  </div>
                  <div className="min-w-0 flex flex-col justify-center gap-1">
                    <p className="text-[11px] text-muted-foreground/80 uppercase tracking-[0.12em] truncate leading-none">Payback Estimado</p>
                    <p className={`text-[22px] font-medium tabular-nums leading-none ${paybackMonths === "recovered" ? "text-emerald-700" : "text-foreground"}`}>
                      {paybackMonths === null ? "" : paybackMonths === "recovered" ? "Recuperado" : `${paybackMonths} meses`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px]">
            <p className="text-xs">Meses estimados para recuperar o investimento, baseado na receita média dos últimos 3 meses</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar veículo..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={turoFilter}
          onChange={(e) => setTuroFilter(e.target.value as any)}
          className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm"
        >
          <option value="listed">Turo</option>
          <option value="unlisted">Particular</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {/* Table */}
      <Card className="border-border/40 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Demonstrativo por Veículo ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            rows.length > 0 ? (
              <EmptyState icon={Search} title="Nenhum veículo encontrado" description="Nenhum veículo corresponde à busca atual." actionLabel="Limpar busca" onAction={() => setSearch("")} />
            ) : (
              <EmptyState icon={TrendingUp} title="Sem dados de rentabilidade" description="A análise de lucro por veículo será exibida quando houver reservas e despesas registradas." />
            )
          ) : (
          <div className="overflow-x-auto">
            <table className="text-sm min-w-full" style={{ minWidth: "1500px" }}>
              <thead className="bg-muted/40 border-y border-border/30">
                <tr>
                  <TH k="name" align="left">Veículo</TH>
                  <TH k="category" align="left">Categoria</TH>
                  <TH k="acquired_date" align="left">Comprado</TH>
                  <TH k="purchase_price">Valor Pago</TH>
                  <TH k="bookings">Locações</TH>
                  <TH k="totalDays">Dias Locados</TH>
                  <TH k="occupancyPct">Ocupação</TH>
                  <TH k="rentalRevenue">Rec. Locação</TH>
                  <TH k="addonRevenue">Rec. Taxas</TH>
                  <TH k="totalRevenue">Receita Total</TH>
                  <TH k="expenses">Gastos</TH>
                  <TH k="operatingProfit">Lucro Oper.</TH>
                  <TH k="roiPct">ROI %</TH>
                  <TH k="damageCount">Avarias</TH>
                  <th className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 text-center whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isSelected = compareIds.includes(r.id);
                  return (
                  <tr
                    key={r.id}
                    onClick={() => {
                      if (!compareMode) return;
                      if (isSelected) setCompareIds(compareIds.filter(id => id !== r.id));
                      else if (compareIds.length < 4) setCompareIds([...compareIds, r.id]);
                    }}
                    className={`border-b border-border/20 transition-colors ${
                      compareMode ? "cursor-pointer" : ""
                    } ${isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/20"}`}
                  >
                    <td className="px-3 py-3 whitespace-nowrap font-medium text-foreground">
                      {compareMode && (
                        <span className={`inline-block w-3 h-3 rounded-sm border-2 mr-2 align-middle ${isSelected ? "bg-primary border-primary" : "border-border"}`} />
                      )}
                      {r.name}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">{r.category}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                      {r.acquired_date
                        ? format(parseISO(r.acquired_date), "dd/MM/yy")
                        : ""}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-foreground">
                      {r.purchase_price > 0 ? `$${fmt(r.purchase_price)}` : ""}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-foreground">{r.bookings}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-foreground">
                      {r.totalDays > 0 ? r.totalDays : <span className="text-muted-foreground"></span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
                      <span className={r.occupancyPct >= 70 ? "text-emerald-700 font-medium" : r.occupancyPct >= 40 ? "text-foreground" : "text-muted-foreground"}>
                        {r.occupancyPct}%
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-foreground">${fmt(r.rentalRevenue)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-muted-foreground">${fmt(r.addonRevenue)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums font-medium text-foreground">${fmt(r.totalRevenue)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-destructive">
                      {r.expenses > 0 ? `-$${fmt(r.expenses)}` : ""}
                    </td>
                    <td className={`px-3 py-3 whitespace-nowrap text-right tabular-nums font-medium ${r.operatingProfit >= 0 ? "text-emerald-700" : "text-destructive"}`}>
                      {r.operatingProfit >= 0 ? "" : "-"}${fmt(Math.abs(r.operatingProfit))}
                    </td>
                    <td className={`px-3 py-3 whitespace-nowrap text-right tabular-nums font-medium ${r.roiPct === null ? "text-muted-foreground" : (r.roiPct >= 0 ? "text-emerald-700" : "text-destructive")}`}>
                      {r.roiPct === null ? "" : `${r.roiPct.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right">
                      {r.damageCount > 0 ? (
                        <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">{r.damageCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground"></span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-center">
                      {r.purchase_price === 0 ? (
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap">Sem dados</Badge>
                      ) : r.paidOff ? (
                        <Badge className="bg-emerald-700/12 text-emerald-700 hover:bg-emerald-700/18 border-0 text-[10px] whitespace-nowrap">Pagou-se</Badge>
                      ) : (
                        <Badge variant="outline" className="border-yellow-500/40 text-yellow-500 text-[10px] whitespace-nowrap">
                          Falta ${fmt(r.purchase_price - (r.totalRevenue - r.expenses))}
                        </Badge>
                      )}
                    </td>
                  </tr>
                  );})}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="bg-muted/40 border-t-2 border-border/60 font-semibold">
                  <tr>
                    <td className="px-3 py-3 whitespace-nowrap text-foreground" colSpan={4}>Totais</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-foreground">${fmt(totals.purchase)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-foreground">
                      {filtered.reduce((s, r) => s + r.bookings, 0)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-foreground">
                      ${fmt(filtered.reduce((s, r) => s + r.rentalRevenue, 0))}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-foreground">
                      ${fmt(filtered.reduce((s, r) => s + r.addonRevenue, 0))}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-foreground">${fmt(totals.revenue)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-destructive">
                      {totals.expenses > 0 ? `-$${fmt(totals.expenses)}` : ""}
                    </td>
                    <td className={`px-3 py-3 whitespace-nowrap text-right tabular-nums font-medium ${totals.opProfit >= 0 ? "text-emerald-700" : "text-destructive"}`}>
                      {totals.opProfit >= 0 ? "" : "-"}${fmt(Math.abs(totals.opProfit))}
                    </td>
                    <td className={`px-3 py-3 whitespace-nowrap text-right tabular-nums ${(globalRoiPct ?? 0) >= 0 ? "text-emerald-700" : "text-destructive"}`}>
                      {globalRoiPct === null ? "" : `${globalRoiPct.toFixed(1)}%`}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
