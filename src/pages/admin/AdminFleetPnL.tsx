import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Car, Search } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  netProfit: number;
  roiPct: number;
  paidOff: boolean;
  daysOwned: number;
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function AdminFleetPnL() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof Row>("netProfit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [vRes, bRes, eRes] = await Promise.all([
      supabase.from("vehicles").select("*"),
      supabase.from("bookings").select("*"),
      supabase.from("vehicle_expenses").select("*"),
    ]);

    const vehs = vRes.data || [];
    const bks = bRes.data || [];
    const exps = eRes.data || [];

    const today = new Date();

    const result: Row[] = vehs.map((v: any) => {
      const vBookings = bks.filter((b: any) => b.vehicle_id === v.id);

      const rentalRevenue = vBookings.reduce((s: number, b: any) => {
        const days = Math.max(differenceInDays(parseISO(b.return_date), parseISO(b.pickup_date)), 1);
        const dailyTotal = days * Number(v.daily_price_usd || 0);
        // fallback: subtract addons total to isolate base rental
        const addons = b.addons || {};
        const addonSum =
          (Number(addons.plan_extra) || 0) +
          (Number(addons.insurance_total) || 0) +
          (Number(addons.child_seat_total) || 0) +
          (Number(addons.toll_tag_total) || 0) +
          (Number(addons.extra_driver_total) || 0) +
          (Number(addons.return_fee) || 0);
        const total = Number(b.total_price) || 0;
        return s + Math.max(total - addonSum, dailyTotal);
      }, 0);

      const addonRevenue = vBookings.reduce((s: number, b: any) => {
        const a = b.addons || {};
        return s +
          (Number(a.plan_extra) || 0) +
          (Number(a.insurance_total) || 0) +
          (Number(a.child_seat_total) || 0) +
          (Number(a.toll_tag_total) || 0) +
          (Number(a.extra_driver_total) || 0) +
          (Number(a.return_fee) || 0);
      }, 0);

      const totalRevenue = rentalRevenue + addonRevenue;

      const vExpenses = exps.filter((e: any) => e.vehicle_id === v.id);
      const expenses = vExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);

      const purchasePrice = Number(v.purchase_price) || 0;
      const netProfit = totalRevenue - expenses - purchasePrice;
      const roiPct = purchasePrice > 0 ? Math.round((netProfit / purchasePrice) * 100) : 0;
      const paidOff = totalRevenue - expenses >= purchasePrice && purchasePrice > 0;

      const daysOwned = v.acquired_date
        ? Math.max(differenceInDays(today, parseISO(v.acquired_date)), 1)
        : 0;

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
        netProfit,
        roiPct,
        paidOff,
        daysOwned,
      };
    });

    setRows(result);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
    );
    return list.sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, search, sortKey, sortDir]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.purchase += r.purchase_price;
        acc.revenue += r.totalRevenue;
        acc.expenses += r.expenses;
        acc.profit += r.netProfit;
        return acc;
      },
      { purchase: 0, revenue: 0, expenses: 0, profit: 0 }
    );
  }, [rows]);

  const toggleSort = (key: keyof Row) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const TH = ({ k, children, align = "right" }: { k: keyof Row; children: React.ReactNode; align?: "left" | "right" }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
      {sortKey === k && <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatório de Frota — Lucro por Veículo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compra, gastos, receitas e lucro líquido de cada carro desde a aquisição
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Car size={18} className="text-foreground" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Investimento</p>
                <p className="text-xl font-bold text-foreground tabular-nums">${fmt(totals.purchase)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Receita Total</p>
                <p className="text-xl font-bold text-foreground tabular-nums">${fmt(totals.revenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown size={18} className="text-destructive" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Gastos Totais</p>
                <p className="text-xl font-bold text-foreground tabular-nums">${fmt(totals.expenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${totals.profit >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
                <TrendingUp size={18} className={totals.profit >= 0 ? "text-green-500" : "text-destructive"} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Lucro Líquido</p>
                <p className={`text-xl font-bold tabular-nums ${totals.profit >= 0 ? "text-green-500" : "text-destructive"}`}>
                  {totals.profit >= 0 ? "" : "-"}${fmt(Math.abs(totals.profit))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar veículo..."
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Table */}
      <Card className="border-border/40 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Demonstrativo por Veículo ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-y border-border/40">
                <tr>
                  <TH k="name" align="left">Veículo</TH>
                  <TH k="acquired_date" align="left">Comprado</TH>
                  <TH k="purchase_price">Valor Pago</TH>
                  <TH k="bookings">Locações</TH>
                  <TH k="rentalRevenue">Rec. Locação</TH>
                  <TH k="addonRevenue">Rec. Taxas</TH>
                  <TH k="totalRevenue">Receita Total</TH>
                  <TH k="expenses">Gastos</TH>
                  <TH k="netProfit">Lucro Líquido</TH>
                  <TH k="roiPct">ROI</TH>
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-3">
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground">{r.category}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {r.acquired_date
                        ? format(parseISO(r.acquired_date), "dd MMM yyyy", { locale: ptBR })
                        : "—"}
                      {r.daysOwned > 0 && (
                        <div className="text-[10px] text-muted-foreground/70">{r.daysOwned} dias</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {r.purchase_price > 0 ? `$${fmt(r.purchase_price)}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">{r.bookings}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">${fmt(r.rentalRevenue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">${fmt(r.addonRevenue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium text-foreground">${fmt(r.totalRevenue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-destructive">
                      {r.expenses > 0 ? `-$${fmt(r.expenses)}` : "—"}
                    </td>
                    <td className={`px-3 py-3 text-right tabular-nums font-bold ${r.netProfit >= 0 ? "text-green-500" : "text-destructive"}`}>
                      {r.netProfit >= 0 ? "" : "-"}${fmt(Math.abs(r.netProfit))}
                    </td>
                    <td className={`px-3 py-3 text-right tabular-nums font-medium ${r.roiPct >= 0 ? "text-green-500" : "text-destructive"}`}>
                      {r.purchase_price > 0 ? `${r.roiPct}%` : "—"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {r.purchase_price === 0 ? (
                        <Badge variant="outline" className="text-[10px]">Sem dados</Badge>
                      ) : r.paidOff ? (
                        <Badge className="bg-green-500/15 text-green-500 hover:bg-green-500/20 border-0 text-[10px]">Pagou-se</Badge>
                      ) : (
                        <Badge variant="outline" className="border-yellow-500/40 text-yellow-500 text-[10px]">
                          Falta ${fmt(r.purchase_price - (r.totalRevenue - r.expenses))}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="bg-muted/40 border-t-2 border-border/60 font-semibold">
                  <tr>
                    <td className="px-3 py-3 text-foreground" colSpan={2}>Totais</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">${fmt(totals.purchase)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {filtered.reduce((s, r) => s + r.bookings, 0)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      ${fmt(filtered.reduce((s, r) => s + r.rentalRevenue, 0))}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      ${fmt(filtered.reduce((s, r) => s + r.addonRevenue, 0))}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">${fmt(totals.revenue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-destructive">-${fmt(totals.expenses)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${totals.profit >= 0 ? "text-green-500" : "text-destructive"}`}>
                      {totals.profit >= 0 ? "" : "-"}${fmt(Math.abs(totals.profit))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
