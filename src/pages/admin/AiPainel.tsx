import { useEffect, useMemo, useState } from "react";
import {
  Brain, Sparkles, TrendingUp, AlertTriangle, Target, Zap, DollarSign,
  Activity, Gauge, Award, Flame, Snowflake, Layers, Rocket, Users,
  Clock, ShieldAlert, Calendar, LineChart, Wallet, ArrowDownRight,
  ArrowUpRight, Repeat, Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  differenceInDays, startOfMonth, endOfMonth, subMonths, format,
  startOfDay, addDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";

type Booking = {
  id: string; status: string; pickup_date: string; return_date: string;
  total_price: number | null; vehicle_id: string | null; customer_name: string | null;
  customer_id?: string | null; created_at?: string | null;
  cancelled_at?: string | null; payment_status?: string | null;
  stripe_session_id?: string | null; turo_reservation_code?: string | null;
};
type Vehicle = {
  id: string; name: string | null; status: string | null; color: string | null;
  daily_price_usd: number | null; purchase_price: number | null;
  acquired_date: string | null; category: string | null;
  brand: string | null; model: string | null;
};
type Expense = { vehicle_id: string; amount: number; expense_date: string; type?: string | null };
type Incident = { id: string; vehicle_id: string | null; severity: string | null; actual_cost: number | null; estimated_cost: number | null; incident_date: string | null };
type FinTx = { type: string; amount: number; transaction_date: string; vehicle_id: string | null; source: string | null; is_cancelled: boolean | null };

const fmtUSD = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const fmtUSD2 = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

type TabKey = "revenue" | "demand" | "customers" | "operations" | "financial" | "strategy";

export default function AiPainel({
  bookings, vehicles,
}: { bookings: Booking[]; vehicles: Vehicle[] }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [transactions, setTransactions] = useState<FinTx[]>([]);
  const [tab, setTab] = useState<TabKey>("revenue");
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const [e, i, t] = await Promise.all([
        supabase.from("vehicle_expenses").select("vehicle_id, amount, expense_date, type"),
        supabase.from("vehicle_incidents").select("id, vehicle_id, severity, actual_cost, estimated_cost, incident_date"),
        supabase.from("financial_transactions").select("type, amount, transaction_date, vehicle_id, source, is_cancelled").eq("is_cancelled", false),
      ]);
      setExpenses((e.data as Expense[]) || []);
      setIncidents((i.data as Incident[]) || []);
      setTransactions((t.data as FinTx[]) || []);
    })();
  }, []);

  const today = useMemo(() => startOfDay(new Date()), []);
  const realBookings = useMemo(
    () => bookings.filter(b => b.status !== "cancelled"),
    [bookings],
  );

  /* ───── Per-vehicle analytics ───── */
  const perVehicle = useMemo(() => {
    return vehicles.map(v => {
      const vb = realBookings.filter(b => b.vehicle_id === v.id);
      const revenue = vb.reduce((s, b) => s + (Number(b.total_price) || 0), 0);
      const exp = expenses.filter(e => e.vehicle_id === v.id)
        .reduce((s, e) => s + Number(e.amount || 0), 0);
      const daysBooked = vb.reduce((s, b) => {
        const d = differenceInDays(new Date(b.return_date), new Date(b.pickup_date));
        return s + Math.max(d, 1);
      }, 0);
      const daysInFleet = v.acquired_date
        ? Math.max(differenceInDays(today, new Date(v.acquired_date)), 1)
        : 1;
      const occupancy = (daysBooked / daysInFleet) * 100;
      const purchase = Number(v.purchase_price) || 0;
      const profit = revenue - exp;
      const roi = purchase > 0 ? (profit / purchase) * 100 : 0;
      const revPerDayOwned = revenue / daysInFleet;
      const daily = Number(v.daily_price_usd) || 0;
      // ADR efetivo realizado
      const adr = daysBooked > 0 ? revenue / daysBooked : 0;
      const adrGap = daily > 0 ? ((adr - daily) / daily) * 100 : 0;
      const paybackMonths = daily > 0 && purchase > 0
        ? Math.ceil(purchase / (daily * 20)) : null;
      // Break-even date
      const dailyRevRate = daysInFleet > 0 ? revenue / daysInFleet : 0;
      const breakEvenDays = purchase > 0 && dailyRevRate > 0
        ? Math.ceil((purchase - (revenue - exp)) / dailyRevRate) : null;
      const breakEvenDate = breakEvenDays !== null && breakEvenDays > 0
        ? addDays(today, breakEvenDays) : null;
      const customerCount = new Set(vb.map(b => b.customer_id || b.customer_name).filter(Boolean)).size;
      return {
        v, revenue, exp, profit, daysBooked, daysInFleet, occupancy, roi,
        revPerDayOwned, paybackMonths, purchase, daily, adr, adrGap, customerCount,
        breakEvenDate, breakEvenDays,
        bookingsCount: vb.length,
      };
    });
  }, [vehicles, realBookings, expenses, today]);

  const fleetRevenue = perVehicle.reduce((s, p) => s + p.revenue, 0);
  const fleetExpenses = perVehicle.reduce((s, p) => s + p.exp, 0);
  const fleetInvested = perVehicle.reduce((s, p) => s + p.purchase, 0);
  const fleetROI = fleetInvested > 0 ? ((fleetRevenue - fleetExpenses) / fleetInvested) * 100 : 0;
  const avgOccupancy = perVehicle.length
    ? perVehicle.reduce((s, p) => s + p.occupancy, 0) / perVehicle.length : 0;
  const totalDaysBooked = perVehicle.reduce((s, p) => s + p.daysBooked, 0);
  const totalDaysAvailable = perVehicle.reduce((s, p) => s + p.daysInFleet, 0);
  const fleetADR = totalDaysBooked > 0 ? fleetRevenue / totalDaysBooked : 0;
  // RevPAC — Revenue per Available Car-day
  const revPAC = totalDaysAvailable > 0 ? fleetRevenue / totalDaysAvailable : 0;
  const fleetMargin = fleetRevenue > 0 ? ((fleetRevenue - fleetExpenses) / fleetRevenue) * 100 : 0;

  /* ───── Rankings ───── */
  const ranked = [...perVehicle].sort((a, b) => b.revPerDayOwned - a.revPerDayOwned);
  const topStars = ranked.slice(0, 3);
  const underperformers = [...perVehicle]
    .filter(p => p.daysInFleet > 60)
    .sort((a, b) => a.revPerDayOwned - b.revPerDayOwned).slice(0, 3);
  const sellCandidates = perVehicle.filter(p =>
    p.daysInFleet > 180 && p.occupancy < 35 && p.purchase > 0 && p.roi < 15
  ).sort((a, b) => a.roi - b.roi).slice(0, 5);
  const priceUpCandidates = perVehicle.filter(p =>
    p.occupancy > 70 && p.bookingsCount >= 3
  ).sort((a, b) => b.occupancy - a.occupancy).slice(0, 5);
  const priceDownCandidates = perVehicle.filter(p =>
    p.occupancy < 25 && p.daysInFleet > 90 && p.daily > 0
  ).sort((a, b) => a.occupancy - b.occupancy).slice(0, 5);

  /* ───── Concentração de receita (estilo Pareto) ───── */
  const concentration = useMemo(() => {
    const totalRev = perVehicle.reduce((s, p) => s + p.revenue, 0);
    const totalInv = perVehicle.reduce((s, p) => s + p.purchase, 0);
    const totalCount = perVehicle.length;
    if (totalRev <= 0 || totalCount === 0) return null;

    const sorted = [...perVehicle].sort((a, b) => b.revenue - a.revenue);

    // Quantos carros são necessários para chegar a 80% da receita
    let acc = 0;
    const topForRev: typeof sorted = [];
    for (const p of sorted) {
      acc += p.revenue;
      topForRev.push(p);
      if (acc / totalRev >= 0.8) break;
    }
    const topRevShare = (acc / totalRev) * 100;
    const topInv = topForRev.reduce((s, p) => s + p.purchase, 0);
    const topInvShare = totalInv > 0 ? (topInv / totalInv) * 100 : 0;
    const topCountShare = (topForRev.length / totalCount) * 100;
    const topAvgOcc = topForRev.reduce((s, p) => s + p.occupancy, 0) / topForRev.length;

    // O que sobra (cauda longa)
    const tail = sorted.slice(topForRev.length);
    const tailRev = tail.reduce((s, p) => s + p.revenue, 0);
    const tailInv = tail.reduce((s, p) => s + p.purchase, 0);
    const tailAvgOcc = tail.length ? tail.reduce((s, p) => s + p.occupancy, 0) / tail.length : 0;

    // Concentração de receita por marca
    const brandRev = new Map<string, number>();
    perVehicle.forEach(p => {
      const k = p.v.brand || p.v.name?.split(" ")[0] || "—";
      brandRev.set(k, (brandRev.get(k) || 0) + p.revenue);
    });
    const topBrand = Array.from(brandRev.entries()).sort((a, b) => b[1] - a[1])[0];
    const topBrandShare = topBrand ? (topBrand[1] / totalRev) * 100 : 0;

    // Concentração por cliente
    const custRev = new Map<string, number>();
    realBookings.forEach(b => {
      const k = b.customer_id || b.customer_name || "—";
      custRev.set(k, (custRev.get(k) || 0) + (Number(b.total_price) || 0));
    });
    const custSorted = Array.from(custRev.values()).sort((a, b) => b - a);
    const top10pct = Math.max(1, Math.ceil(custSorted.length * 0.1));
    const top10Rev = custSorted.slice(0, top10pct).reduce((s, x) => s + x, 0);
    const top10Share = totalRev > 0 ? (top10Rev / totalRev) * 100 : 0;

    return {
      topForRev, topRevShare, topInvShare, topCountShare, topAvgOcc,
      tail, tailRev, tailInv, tailAvgOcc, totalRev, totalInv, totalCount,
      topBrand: topBrand ? { name: topBrand[0], share: topBrandShare } : null,
      topCustomers: { count: top10pct, share: top10Share, total: custSorted.length },
    };
  }, [perVehicle, realBookings]);


  /* ───── Category & Brand ───── */
  const byCategory = useMemo(() => {
    const map = new Map<string, { revenue: number; days: number; count: number; occ: number }>();
    perVehicle.forEach(p => {
      const k = p.v.category || "—";
      const cur = map.get(k) || { revenue: 0, days: 0, count: 0, occ: 0 };
      cur.revenue += p.revenue;
      cur.days += p.daysInFleet;
      cur.count += 1;
      cur.occ += p.occupancy;
      map.set(k, cur);
    });
    return Array.from(map.entries())
      .map(([cat, v]) => ({
        cat, ...v,
        rpd: v.days ? v.revenue / v.days : 0,
        avgOcc: v.count ? v.occ / v.count : 0,
      }))
      .sort((a, b) => b.rpd - a.rpd);
  }, [perVehicle]);

  const byBrand = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number; occupancy: number }>();
    perVehicle.forEach(p => {
      const k = p.v.brand || p.v.name?.split(" ")[0] || "—";
      const cur = map.get(k) || { revenue: 0, count: 0, occupancy: 0 };
      cur.revenue += p.revenue;
      cur.count += 1;
      cur.occupancy += p.occupancy;
      map.set(k, cur);
    });
    return Array.from(map.entries())
      .map(([brand, v]) => ({ brand, ...v, avgOcc: v.occupancy / v.count }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [perVehicle]);

  /* ───── Monthly trend (last 6 months) ───── */
  const monthlyTrend = useMemo(() => {
    const out: { label: string; revenue: number; bookings: number; date: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const anchor = startOfMonth(subMonths(today, i));
      const end = endOfMonth(anchor);
      const inM = realBookings.filter(b => {
        const d = new Date(b.pickup_date);
        return d >= anchor && d <= end;
      });
      out.push({
        label: format(anchor, "MMM", { locale: ptBR }),
        date: anchor,
        revenue: inM.reduce((s, b) => s + (Number(b.total_price) || 0), 0),
        bookings: inM.length,
      });
    }
    return out;
  }, [realBookings, today]);
  const maxBar = Math.max(...monthlyTrend.map(m => m.revenue), 1);

  /* ───── Pacing MTD vs same day last month ───── */
  const pacing = useMemo(() => {
    const mtdStart = startOfMonth(today);
    const dayOfMonth = differenceInDays(today, mtdStart);
    const lastMonthStart = startOfMonth(subMonths(today, 1));
    const lastMonthSameDay = addDays(lastMonthStart, dayOfMonth);
    const mtd = realBookings.filter(b => {
      const d = new Date(b.pickup_date);
      return d >= mtdStart && d <= today;
    }).reduce((s, b) => s + (Number(b.total_price) || 0), 0);
    const lmtd = realBookings.filter(b => {
      const d = new Date(b.pickup_date);
      return d >= lastMonthStart && d <= lastMonthSameDay;
    }).reduce((s, b) => s + (Number(b.total_price) || 0), 0);
    const delta = lmtd > 0 ? ((mtd - lmtd) / lmtd) * 100 : 0;
    return { mtd, lmtd, delta };
  }, [realBookings, today]);

  /* ───── Cash pipelines ───── */
  const next30 = useMemo(() => {
    const horizon = addDays(today, 30);
    return realBookings.filter(b => {
      const d = new Date(b.pickup_date);
      return d >= today && d <= horizon;
    }).reduce((s, b) => s + (Number(b.total_price) || 0), 0);
  }, [realBookings, today]);
  const next60 = useMemo(() => {
    const horizon = addDays(today, 60);
    return realBookings.filter(b => {
      const d = new Date(b.pickup_date);
      return d >= today && d <= horizon;
    }).reduce((s, b) => s + (Number(b.total_price) || 0), 0);
  }, [realBookings, today]);

  /* ───── Booking lead time ───── */
  const leadTime = useMemo(() => {
    const ds: number[] = [];
    realBookings.forEach(b => {
      if (!b.created_at) return;
      const lt = differenceInDays(new Date(b.pickup_date), new Date(b.created_at));
      if (lt >= 0 && lt < 365) ds.push(lt);
    });
    if (!ds.length) return { avg: 0, median: 0, sample: 0 };
    ds.sort((a, b) => a - b);
    return {
      avg: ds.reduce((s, x) => s + x, 0) / ds.length,
      median: ds[Math.floor(ds.length / 2)],
      sample: ds.length,
    };
  }, [realBookings]);

  /* ───── DoW heatmap (pickup) ───── */
  const dowHeat = useMemo(() => {
    const arr = [0, 0, 0, 0, 0, 0, 0]; // dom..sab
    realBookings.forEach(b => {
      const d = new Date(b.pickup_date);
      arr[d.getDay()] += 1;
    });
    const max = Math.max(...arr, 1);
    const labels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    return arr.map((v, i) => ({ label: labels[i], v, pct: (v / max) * 100 }));
  }, [realBookings]);

  /* ───── Funnel ───── */
  const funnel = useMemo(() => {
    const total = bookings.length;
    const confirmed = bookings.filter(b => ["confirmed", "active", "in_progress", "completed"].includes(b.status)).length;
    const inProg = bookings.filter(b => ["in_progress", "completed"].includes(b.status)).length;
    const completed = bookings.filter(b => b.status === "completed").length;
    const cancelled = bookings.filter(b => b.status === "cancelled").length;
    return { total, confirmed, inProg, completed, cancelled };
  }, [bookings]);

  /* ───── Opportunity windows (gaps > 3d between two confirmed bookings) ───── */
  const opportunityWindows = useMemo(() => {
    const out: { vehicle: string; vehicleId: string; gapStart: Date; gapEnd: Date; nights: number; estLoss: number }[] = [];
    vehicles.forEach(v => {
      const future = realBookings
        .filter(b => b.vehicle_id === v.id && new Date(b.return_date) >= today)
        .sort((a, b) => new Date(a.pickup_date).getTime() - new Date(b.pickup_date).getTime());
      for (let i = 0; i < future.length - 1; i++) {
        const aEnd = new Date(future[i].return_date);
        const bStart = new Date(future[i + 1].pickup_date);
        const gap = differenceInDays(bStart, aEnd);
        if (gap >= 3 && gap <= 14) {
          const daily = Number(v.daily_price_usd) || 0;
          out.push({
            vehicle: v.name || "—",
            vehicleId: v.id,
            gapStart: aEnd, gapEnd: bStart,
            nights: gap,
            estLoss: gap * daily * 0.7, // assume 70% recoverable
          });
        }
      }
    });
    return out.sort((a, b) => b.estLoss - a.estLoss).slice(0, 6);
  }, [vehicles, realBookings, today]);

  /* ───── Customers: RFM-like ───── */
  const customers = useMemo(() => {
    const map = new Map<string, { name: string; trips: number; revenue: number; lastDate: Date | null; firstDate: Date | null }>();
    realBookings.forEach(b => {
      const key = b.customer_id || b.customer_name || "—";
      const cur = map.get(key) || { name: b.customer_name || "—", trips: 0, revenue: 0, lastDate: null, firstDate: null };
      cur.trips += 1;
      cur.revenue += Number(b.total_price) || 0;
      const d = new Date(b.pickup_date);
      if (!cur.lastDate || d > cur.lastDate) cur.lastDate = d;
      if (!cur.firstDate || d < cur.firstDate) cur.firstDate = d;
      map.set(key, cur);
    });
    return Array.from(map.values()).map(c => {
      const recency = c.lastDate ? differenceInDays(today, c.lastDate) : 9999;
      const span = c.firstDate && c.lastDate ? differenceInDays(c.lastDate, c.firstDate) : 0;
      const avgInterval = c.trips > 1 ? span / (c.trips - 1) : 0;
      const churnRisk = c.trips >= 2 && avgInterval > 0 ? Math.min(100, (recency / avgInterval) * 50) : 0;
      let segment: "Champion" | "Loyal" | "At Risk" | "Hibernating" | "New";
      if (c.trips >= 4 && recency <= 90) segment = "Champion";
      else if (c.trips >= 2 && recency <= 180) segment = "Loyal";
      else if (c.trips >= 2 && recency > 180) segment = "At Risk";
      else if (c.trips === 1 && recency > 180) segment = "Hibernating";
      else segment = "New";
      return { ...c, recency, avgInterval, churnRisk, segment };
    });
  }, [realBookings, today]);

  const segmentCounts = useMemo(() => {
    const acc: Record<string, number> = { Champion: 0, Loyal: 0, "At Risk": 0, Hibernating: 0, New: 0 };
    customers.forEach(c => { acc[c.segment] = (acc[c.segment] || 0) + 1; });
    return acc;
  }, [customers]);

  const topCustomers = [...customers].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const churnRisks = [...customers].filter(c => c.churnRisk >= 60 && c.revenue > 500).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const repeatRate = customers.length
    ? (customers.filter(c => c.trips >= 2).length / customers.length) * 100 : 0;

  /* ───── Operations ───── */
  const turnaround = useMemo(() => {
    const gaps: number[] = [];
    vehicles.forEach(v => {
      const list = realBookings.filter(b => b.vehicle_id === v.id)
        .sort((a, b) => new Date(a.pickup_date).getTime() - new Date(b.pickup_date).getTime());
      for (let i = 0; i < list.length - 1; i++) {
        const g = differenceInDays(new Date(list[i + 1].pickup_date), new Date(list[i].return_date));
        if (g >= 0 && g < 60) gaps.push(g);
      }
    });
    if (!gaps.length) return { avg: 0, min: 0, sample: 0 };
    return {
      avg: gaps.reduce((s, x) => s + x, 0) / gaps.length,
      min: Math.min(...gaps),
      sample: gaps.length,
    };
  }, [vehicles, realBookings]);

  const incidentByVehicle = useMemo(() => {
    const map = new Map<string, { count: number; cost: number }>();
    incidents.forEach(i => {
      if (!i.vehicle_id) return;
      const cur = map.get(i.vehicle_id) || { count: 0, cost: 0 };
      cur.count += 1;
      cur.cost += Number(i.actual_cost ?? i.estimated_cost ?? 0);
      map.set(i.vehicle_id, cur);
    });
    return vehicles.map(v => ({
      v,
      ...(map.get(v.id) || { count: 0, cost: 0 }),
    })).sort((a, b) => b.count - a.count);
  }, [incidents, vehicles]);

  /* ───── Financial channels (Stripe vs Turo proxy) ───── */
  const channelMix = useMemo(() => {
    let stripe = 0, turo = 0, other = 0;
    bookings.forEach(b => {
      if (b.status === "cancelled") return;
      const r = Number(b.total_price) || 0;
      if (b.stripe_session_id) stripe += r;
      else if ((b as any).turo_reservation_code) turo += r;
      else other += r;
    });
    return { stripe, turo, other };
  }, [bookings]);

  /* ───── Anomaly detection (current month bookings vs prior 3-month avg) ───── */
  const anomalies = useMemo(() => {
    const list: { label: string; severity: "high" | "med"; msg: string }[] = [];
    if (monthlyTrend.length >= 4) {
      const prior = monthlyTrend.slice(-4, -1);
      const cur = monthlyTrend[monthlyTrend.length - 1];
      const mean = prior.reduce((s, m) => s + m.revenue, 0) / prior.length;
      const variance = prior.reduce((s, m) => s + (m.revenue - mean) ** 2, 0) / prior.length;
      const sd = Math.sqrt(variance);
      if (sd > 0) {
        const z = (cur.revenue - mean) / sd;
        if (z < -1.5) list.push({ label: "Receita do mês", severity: "high", msg: `Receita ${Math.abs(((cur.revenue - mean) / mean) * 100).toFixed(0)}% abaixo da média dos últimos 3 meses (z=${z.toFixed(1)}σ).` });
        else if (z > 1.5) list.push({ label: "Receita do mês", severity: "med", msg: `Receita ${(((cur.revenue - mean) / mean) * 100).toFixed(0)}% acima da média — momento de capturar mais demanda.` });
      }
    }
    const cancelRate = funnel.total > 0 ? (funnel.cancelled / funnel.total) * 100 : 0;
    if (cancelRate > 20) list.push({ label: "Cancelamentos", severity: "high", msg: `Taxa de cancelamento em ${cancelRate.toFixed(1)}% — investigar causas operacionais.` });
    if (avgOccupancy < 30) list.push({ label: "Ocupação", severity: "high", msg: `Ocupação média em ${avgOccupancy.toFixed(0)}% — frota com capacidade ociosa significativa.` });
    sellCandidates.slice(0, 1).forEach(c => list.push({ label: "Ativo improdutivo", severity: "med", msg: `${c.v.name} está há ${c.daysInFleet} dias na frota com ROI de ${c.roi.toFixed(1)}%.` }));
    return list.slice(0, 4);
  }, [monthlyTrend, funnel, avgOccupancy, sellCandidates]);

  /* ───── AI Executive Briefing ───── */
  useEffect(() => {
    if (!perVehicle.length) return;
    if (briefing !== null) return;
    void (async () => {
      setBriefingLoading(true);
      try {
        const payload = {
          fleetSize: perVehicle.length,
          fleetRevenue, fleetROI, avgOccupancy, revPAC, fleetADR, fleetMargin,
          repeatRate, leadTime: leadTime.avg, turnaround: turnaround.avg,
          pacing,
          topCategory: byCategory[0]?.cat,
          topStar: topStars[0]?.v.name,
          sellCandidatesCount: sellCandidates.length,
          priceUpCount: priceUpCandidates.length,
          opportunityWindows: opportunityWindows.length,
          champions: segmentCounts.Champion,
          atRisk: segmentCounts["At Risk"],
          anomalies: anomalies.map(a => a.msg),
        };
        const { data, error } = await supabase.functions.invoke("intelligence-summary", { body: payload });
        if (!error && (data as any)?.text) setBriefing((data as any).text as string);
        else setBriefing(localBriefing(payload));
      } catch {
        setBriefing(localBriefing({
          fleetROI, avgOccupancy, revPAC, fleetADR, fleetMargin, repeatRate,
          pacing, sellCandidatesCount: sellCandidates.length,
          priceUpCount: priceUpCandidates.length,
          opportunityWindows: opportunityWindows.length,
          champions: segmentCounts.Champion, atRisk: segmentCounts["At Risk"],
          topCategory: byCategory[0]?.cat, topStar: topStars[0]?.v.name,
        }));
      } finally { setBriefingLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perVehicle.length]);

  const tabs: { key: TabKey; label: string; icon: typeof Brain }[] = [
    { key: "revenue", label: "Receita", icon: DollarSign },
    { key: "demand", label: "Reservas", icon: Activity },
    { key: "customers", label: "Clientes", icon: Users },
    { key: "operations", label: "Operação", icon: Gauge },
    { key: "financial", label: "Dinheiro", icon: Wallet },
    { key: "strategy", label: "Recomendações", icon: Wand2 },
  ];

  return (
    <div className="ai-shell relative -mx-4 lg:-mx-6 -mt-3 lg:-mt-6 px-3 sm:px-4 lg:px-8 pt-4 sm:pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] min-h-[calc(100vh-120px)]">
      <div className="ai-bg-grid" />
      <div className="ai-bg-glow" />
      <div className="ai-bg-noise" />

      <div className="relative z-10 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="ai-badge">
                <Sparkles size={11} strokeWidth={2} />
                <span>MODO IA ATIVADO</span>
                <span className="ai-pulse" />
              </div>
              <div className="ai-chip sm:hidden"><Brain size={12} /><span>Análise IA</span></div>
            </div>
            <h1 className="ai-title">Painel Inteligente</h1>
            <p className="ai-subtitle">
              {perVehicle.length} carros · {realBookings.length} reservas · {customers.length} clientes únicos
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div className="ai-chip"><Brain size={12} /><span>Análise IA</span></div>
          </div>
        </div>

        {/* Hero KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <AiKpi label="Receita por carro/dia" sub="Quanto cada carro gera, na média, por dia que está na frota" value={fmtUSD2(revPAC)} icon={Rocket} hue="violet" />
          <AiKpi label="Diária média cobrada" sub="Valor médio efetivamente recebido por dia alugado" value={fmtUSD(fleetADR)} icon={DollarSign} hue="amber" />
          <AiKpi label="Margem de lucro" sub="Receita menos despesas, em %" value={`${fleetMargin.toFixed(1)}%`} icon={Target} hue={fleetMargin >= 25 ? "emerald" : "rose"} />
          <AiKpi label="Receita do mês até hoje" sub={`No mesmo dia do mês passado: ${fmtUSD(pacing.lmtd)} (${pacing.delta >= 0 ? "+" : ""}${pacing.delta.toFixed(1)}%)`} value={fmtUSD(pacing.mtd)} icon={pacing.delta >= 0 ? ArrowUpRight : ArrowDownRight} hue={pacing.delta >= 0 ? "emerald" : "rose"} />
        </div>


        {/* AI Briefing */}
        <div className="ai-insight">
          <div className="flex items-start gap-3">
            <div className="ai-insight-icon"><Brain size={16} /></div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 mb-1">
                {briefingLoading ? "Analisando dados da sua frota..." : "O que a IA está vendo agora"}
              </div>
              <p className="text-[13.5px] text-white/90 leading-relaxed whitespace-pre-line">
                {briefing ?? "Carregando análise..."}
              </p>
            </div>
          </div>
        </div>

        {/* Anomaly alerts */}
        {anomalies.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {anomalies.map((a, i) => (
              <div key={i} className={`ai-alert ${a.severity === "high" ? "ai-alert-high" : "ai-alert-med"}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={13} className={a.severity === "high" ? "text-rose-300" : "text-amber-300"} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-white/60">{a.label}</div>
                    <div className="text-[12px] text-white/90 mt-1 leading-snug">{a.msg}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="ai-tabs">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`ai-tab ${tab === t.key ? "ai-tab-active" : ""}`}>
              <t.icon size={12} /> <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ───── Tab: REVENUE ───── */}
        {tab === "revenue" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="ai-card lg:col-span-2">
                <CardHeader title="Receita dos últimos 6 meses" sub="Como sua frota faturou mês a mês" icon={LineChart} />
                <div className="flex items-end gap-3 h-40">
                  {monthlyTrend.map((m, i) => {
                    const h = (m.revenue / maxBar) * 100;
                    const isMax = m.revenue === maxBar && m.revenue > 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="text-[10px] tabular-nums text-white/60">{fmtUSD(m.revenue)}</div>
                        <div className="w-full relative" style={{ height: "120px" }}>
                          <div className={`absolute bottom-0 left-0 right-0 rounded-t-md transition-all ${isMax ? "ai-bar-hot" : "ai-bar"}`} style={{ height: `${Math.max(h, 4)}%` }} />
                        </div>
                        <div className="text-[11px] uppercase tracking-wider text-white/50">{m.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="ai-card">
                <CardHeader title="Está cobrando menos que a tabela?" sub="Diária real recebida vs preço cadastrado" icon={DollarSign} />
                <ul className="space-y-2.5">
                  {[...perVehicle].filter(p => p.bookingsCount > 0 && p.daily > 0).sort((a, b) => a.adrGap - b.adrGap).slice(0, 5).map(p => (
                    <li key={p.v.id} className="text-[12.5px]">
                      <div className="flex justify-between gap-2">
                        <span className="text-white/85 truncate">{p.v.name}</span>
                        <span className={`tabular-nums ${p.adrGap < -10 ? "text-rose-300" : p.adrGap > 5 ? "text-emerald-300" : "text-white/70"}`}>
                          {p.adrGap >= 0 ? "+" : ""}{p.adrGap.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-[10.5px] text-white/50">Recebido {fmtUSD(p.adr)}/dia · tabela {fmtUSD(p.daily)}/dia</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <KpiBlock title="Receita total acumulada" value={fmtUSD(fleetRevenue)} sub={`Despesas registradas: ${fmtUSD(fleetExpenses)}`} icon={DollarSign} />
              <KpiBlock title="Receita confirmada — próximos 30 dias" value={fmtUSD(next30)} sub={`Em 60 dias: ${fmtUSD(next60)}`} icon={Rocket} />
              <KpiBlock title="Ocupação média da frota" value={`${avgOccupancy.toFixed(1)}%`} sub={`${totalDaysBooked} dias alugados no total`} icon={Gauge} />
            </div>
          </div>
        )}

        {/* ───── Tab: DEMAND ───── */}
        {tab === "demand" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="ai-card">
                <CardHeader title="Com quanto tempo o cliente reserva" sub="Antecedência média entre fazer a reserva e retirar o carro" icon={Clock} />
                <div className="text-3xl font-light text-cyan-200 tabular-nums">{leadTime.avg.toFixed(0)}<span className="text-base text-white/50"> dias</span></div>
                <div className="text-[11px] text-white/55 mt-1">Metade dos clientes reserva com até {leadTime.median} dias de antecedência · base: {leadTime.sample} reservas</div>
              </div>
              <div className="ai-card">
                <CardHeader title="O que está acontecendo com as reservas" sub="Quantas chegam, confirmam, viajam e cancelam" icon={Activity} />
                <FunnelBar label="Reservas criadas" value={funnel.total} max={funnel.total} hue="violet" />
                <FunnelBar label="Confirmadas" value={funnel.confirmed} max={funnel.total} hue="cyan" />
                <FunnelBar label="Em viagem agora ou já viajou" value={funnel.inProg} max={funnel.total} hue="amber" />
                <FunnelBar label="Concluídas" value={funnel.completed} max={funnel.total} hue="emerald" />
                <FunnelBar label="Canceladas" value={funnel.cancelled} max={funnel.total} hue="rose" />
              </div>
              <div className="ai-card">
                <CardHeader title="Quais dias da semana saem mais carros" sub="Dias mais movimentados na retirada" icon={Calendar} />
                <div className="grid grid-cols-7 gap-1.5">
                  {dowHeat.map(d => (
                    <div key={d.label} className="flex flex-col items-center gap-1">
                      <div className="w-full rounded-md ai-heat" style={{ height: 56, opacity: 0.25 + (d.pct / 100) * 0.75 }} />
                      <div className="text-[9.5px] uppercase tracking-wider text-white/60">{d.label}</div>
                      <div className="text-[10.5px] tabular-nums text-white/85">{d.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ai-card">
              <CardHeader title="Buracos entre reservas — dinheiro na mesa" sub="Períodos curtos em que o carro fica parado entre duas reservas confirmadas. Oferecer promo de última hora pode capturar essa receita." icon={Sparkles} />
              {opportunityWindows.length === 0 ? (
                <p className="text-white/55 text-xs">Sem buracos relevantes no momento — agenda bem encaixada.</p>
              ) : (
                <ul className="space-y-2.5">
                  {opportunityWindows.map((o, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 text-[12.5px]">
                      <div className="min-w-0">
                        <div className="text-white/90 truncate">{o.vehicle}</div>
                        <div className="text-[10.5px] text-white/55">
                          Livre de {format(o.gapStart, "dd MMM", { locale: ptBR })} até {format(o.gapEnd, "dd MMM", { locale: ptBR })} · {o.nights} noites paradas
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tabular-nums text-emerald-200/95">{fmtUSD(o.estLoss)}</div>
                        <div className="text-[10px] text-white/50">possível recuperar</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ───── Tab: CUSTOMERS ───── */}
        {tab === "customers" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              {([
                { k: "Champion", pt: "Fiéis VIP", help: "4+ reservas, voltaram nos últimos 90 dias" },
                { k: "Loyal", pt: "Recorrentes", help: "2+ reservas, ativos nos últimos 6 meses" },
                { k: "At Risk", pt: "Em risco", help: "Já voltaram antes, mas sumiram há mais de 6 meses" },
                { k: "Hibernating", pt: "Adormecidos", help: "Alugaram uma vez e nunca mais voltaram" },
                { k: "New", pt: "Novos", help: "Primeira reserva recente" },
              ] as const).map(s => (
                <div key={s.k} className="ai-card text-center py-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/55">{s.pt}</div>
                  <div className="text-2xl font-light text-white/90 tabular-nums mt-1">{segmentCounts[s.k] || 0}</div>
                  <div className="text-[9.5px] text-white/45 mt-1 px-1 leading-tight">{s.help}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="ai-card">
                <CardHeader title="Clientes que voltaram" sub="% de clientes com 2 ou mais reservas" icon={Repeat} />
                <div className="text-3xl font-light text-emerald-200 tabular-nums">{repeatRate.toFixed(1)}%</div>
                <div className="text-[11px] text-white/55 mt-1">{customers.filter(c => c.trips >= 2).length} clientes voltaram, de {customers.length} no total</div>
              </div>
              <div className="ai-card lg:col-span-2">
                <CardHeader title="Clientes valiosos que estão sumindo" sub="Já gastaram bem na sua frota e estão demorando mais do que o normal para voltar — vale uma mensagem" icon={ShieldAlert} />
                {churnRisks.length === 0 ? <p className="text-white/55 text-xs">Nenhum cliente importante em zona de risco.</p> : (
                  <ul className="space-y-2.5">
                    {churnRisks.map((c, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-[12.5px]">
                        <div className="min-w-0">
                          <div className="text-white/90 truncate">{c.name}</div>
                          <div className="text-[10.5px] text-white/55">{c.trips} reservas · sem alugar há {c.recency} dias (costuma voltar a cada {c.avgInterval.toFixed(0)} dias)</div>
                        </div>
                        <div className="text-right">
                          <div className="tabular-nums text-rose-300">{c.churnRisk.toFixed(0)}%</div>
                          <div className="text-[10px] text-white/50">já gastou {fmtUSD(c.revenue)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="ai-card">
              <CardHeader title="Top 5 clientes que mais gastaram" sub="Receita total acumulada na sua frota" icon={Award} />
              <ul className="space-y-2.5">
                {topCustomers.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <div className="min-w-0">
                      <div className="text-white/90 truncate">{c.name}</div>
                      <div className="text-[10.5px] text-white/55">{c.trips} reservas · {ptSegment(c.segment)}</div>
                    </div>
                    <span className="tabular-nums text-amber-200/95">{fmtUSD(c.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ───── Tab: OPERATIONS ───── */}
        {tab === "operations" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="ai-card">
                <CardHeader title="Tempo parado entre uma reserva e outra" sub="Quanto tempo em média o carro fica parado entre uma devolução e a próxima retirada" icon={Clock} />
                <div className="text-3xl font-light text-cyan-200 tabular-nums">{turnaround.avg.toFixed(1)}<span className="text-base text-white/50"> dias</span></div>
                <div className="text-[11px] text-white/55 mt-1">Melhor caso: {turnaround.min} dia(s) · base: {turnaround.sample} trocas</div>
              </div>
              <div className="ai-card">
                <CardHeader title="Total de incidentes" sub="Avarias, batidas e ocorrências registradas" icon={ShieldAlert} />
                <div className="text-3xl font-light text-rose-200 tabular-nums">{incidents.length}</div>
                <div className="text-[11px] text-white/55 mt-1">Custo total: {fmtUSD(incidents.reduce((s, i) => s + Number(i.actual_cost ?? i.estimated_cost ?? 0), 0))}</div>
              </div>
              <div className="ai-card">
                <CardHeader title="Carros com mais problemas" sub="Quais veículos acumularam mais incidentes" icon={Flame} />
                <ul className="space-y-1.5">
                  {incidentByVehicle.filter(x => x.count > 0).slice(0, 4).map(x => (
                    <li key={x.v.id} className="flex justify-between text-[12px]">
                      <span className="text-white/85 truncate">{x.v.name}</span>
                      <span className="tabular-nums text-rose-300">{x.count} ocorrências · {fmtUSD(x.cost)}</span>
                    </li>
                  ))}
                  {incidentByVehicle.filter(x => x.count > 0).length === 0 && <li className="text-white/55 text-xs">Nenhum incidente registrado.</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ───── Tab: FINANCIAL ───── */}
        {tab === "financial" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="ai-card">
                <CardHeader title="De onde vem a receita" sub="Quanto cada canal gerou de aluguel" icon={Layers} />
                <ChannelBar label="Site Zeus (Stripe)" value={channelMix.stripe} total={channelMix.stripe + channelMix.turo + channelMix.other} hue="cyan" />
                <ChannelBar label="Turo" value={channelMix.turo} total={channelMix.stripe + channelMix.turo + channelMix.other} hue="violet" />
                <ChannelBar label="Outros (reserva manual)" value={channelMix.other} total={channelMix.stripe + channelMix.turo + channelMix.other} hue="amber" />
              </div>
              <div className="ai-card lg:col-span-2">
                <CardHeader title="Quando o carro se paga" sub="Previsão de quando a receita acumulada cobre o preço de compra do carro" icon={Target} />
                <ul className="space-y-2.5">
                  {perVehicle.filter(p => p.breakEvenDate && p.purchase > 0).sort((a, b) => (a.breakEvenDays ?? 0) - (b.breakEvenDays ?? 0)).slice(0, 6).map(p => (
                    <li key={p.v.id} className="flex justify-between text-[12.5px]">
                      <span className="text-white/85 truncate">{p.v.name}</span>
                      <span className="tabular-nums text-emerald-200">
                        {p.breakEvenDays! <= 0 ? "Já se pagou" : `Em ${p.breakEvenDays} dias · ${format(p.breakEvenDate!, "MMM 'de' yyyy", { locale: ptBR })}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <KpiBlock title="Total investido em carros" value={fmtUSD(fleetInvested)} sub="Soma do preço de compra de toda a frota" icon={Wallet} />
              <KpiBlock title="Receita total já gerada" value={fmtUSD(fleetRevenue)} sub={`Margem de lucro atual: ${fleetMargin.toFixed(1)}%`} icon={DollarSign} />
              <KpiBlock title="Retorno sobre o investimento" value={`${fleetROI.toFixed(1)}%`} sub="Quanto a frota já devolveu do que foi investido" icon={Target} />
            </div>
          </div>
        )}

        {/* ───── Tab: STRATEGY ───── */}
        {tab === "strategy" && (
          <div className="space-y-3">
            {concentration && concentration.topForRev.length > 0 && (
              <div className="ai-card relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-12 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span className="text-[11px] uppercase tracking-[0.18em] text-amber-200/80">Revelação da IA</span>
                  </div>
                  <h3 className="text-lg md:text-xl font-light text-white leading-snug mb-3">
                    <span className="text-amber-200 font-medium tabular-nums">{concentration.topRevShare.toFixed(0)}%</span> da sua receita vem de{" "}
                    <span className="text-amber-200 font-medium tabular-nums">{concentration.topForRev.length} carro{concentration.topForRev.length > 1 ? "s" : ""}</span>
                    {" "}— que representa apenas{" "}
                    <span className="text-amber-200 font-medium tabular-nums">{concentration.topCountShare.toFixed(0)}%</span> da frota
                    {concentration.topInvShare > 0 && (
                      <> e <span className="text-amber-200 font-medium tabular-nums">{concentration.topInvShare.toFixed(0)}%</span> do total investido</>
                    )}.
                  </h3>
                  <p className="text-[13px] text-white/70 leading-relaxed mb-4">
                    Esses carros estão alugados em média <span className="text-emerald-200 tabular-nums">{concentration.topAvgOcc.toFixed(0)}%</span> do tempo,
                    {concentration.tail.length > 0 && (
                      <> enquanto o restante da frota ({concentration.tail.length} carro{concentration.tail.length > 1 ? "s" : ""}) gira apenas <span className="text-rose-200 tabular-nums">{concentration.tailAvgOcc.toFixed(0)}%</span> do tempo.</>
                    )}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                    <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                      <div className="text-[10.5px] uppercase tracking-wider text-white/50 mb-1">Receita dos campeões</div>
                      <div className="text-lg font-light text-amber-200 tabular-nums">{fmtUSD(concentration.topForRev.reduce((s, p) => s + p.revenue, 0))}</div>
                      <div className="text-[11px] text-white/55 mt-0.5">de {fmtUSD(concentration.totalRev)} no total</div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                      <div className="text-[10.5px] uppercase tracking-wider text-white/50 mb-1">Investido nos campeões</div>
                      <div className="text-lg font-light text-cyan-200 tabular-nums">{fmtUSD(concentration.topForRev.reduce((s, p) => s + p.purchase, 0))}</div>
                      <div className="text-[11px] text-white/55 mt-0.5">de {fmtUSD(concentration.totalInv)} investidos</div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                      <div className="text-[10.5px] uppercase tracking-wider text-white/50 mb-1">Receita perdida na cauda</div>
                      <div className="text-lg font-light text-rose-200 tabular-nums">{fmtUSD(concentration.tailRev)}</div>
                      <div className="text-[11px] text-white/55 mt-0.5">{concentration.tail.length} carros somam só {(100 - concentration.topRevShare).toFixed(0)}% da receita</div>
                    </div>
                  </div>

                  <ul className="space-y-1.5 mb-4">
                    {concentration.topForRev.slice(0, 5).map((p, i) => (
                      <li key={p.v.id} className="flex items-center justify-between text-[12.5px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-amber-400/15 border border-amber-300/30 text-amber-200 text-[10px] flex items-center justify-center tabular-nums">{i + 1}</span>
                          <span className="text-white/85 truncate">{p.v.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="tabular-nums text-amber-200">{fmtUSD(p.revenue)} <span className="text-white/45 text-[10.5px]">· {((p.revenue / concentration.totalRev) * 100).toFixed(1)}%</span></div>
                          <div className="text-[10.5px] text-white/50">{p.occupancy.toFixed(0)}% de uso · ROI {p.roi.toFixed(0)}%</div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="rounded-lg bg-amber-300/[0.06] border border-amber-300/20 p-3">
                    <div className="text-[11px] uppercase tracking-wider text-amber-200/80 mb-1">O que isso significa para você</div>
                    <p className="text-[13px] text-white/85 leading-relaxed">
                      A frota está apoiada em poucos carros. Antes de comprar veículos novos, vale: <span className="text-white">(1)</span> proteger esses campeões com manutenção em dia e preço otimizado;{" "}
                      <span className="text-white">(2)</span> considerar vender ou trocar parte dos carros da cauda longa que não estão pagando o espaço que ocupam;{" "}
                      <span className="text-white">(3)</span> usar o perfil dos campeões como referência ao escolher a próxima compra.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(concentration?.topBrand || (concentration && concentration.topCustomers.share > 0)) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {concentration?.topBrand && (
                  <div className="ai-card">
                    <CardHeader title="Dependência de uma marca" sub="Quanto da sua receita depende de uma única marca" icon={Layers} />
                    <div className="text-2xl font-light text-white tabular-nums">
                      {concentration.topBrand.share.toFixed(0)}% <span className="text-base text-white/50">vem de {concentration.topBrand.name}</span>
                    </div>
                    <p className="text-[12px] text-white/60 mt-2 leading-relaxed">
                      {concentration.topBrand.share > 50
                        ? "Concentração alta. Se essa marca tiver um problema (recall, manutenção, demanda fria), o impacto no caixa é grande. Vale diversificar nas próximas compras."
                        : "Distribuição saudável entre marcas — risco diluído."}
                    </p>
                  </div>
                )}
                {concentration && concentration.topCustomers.share > 0 && (
                  <div className="ai-card">
                    <CardHeader title="Dependência de poucos clientes" sub="Quanto vem dos seus melhores clientes" icon={Users} />
                    <div className="text-2xl font-light text-white tabular-nums">
                      {concentration.topCustomers.share.toFixed(0)}% <span className="text-base text-white/50">vem dos top {concentration.topCustomers.count} clientes</span>
                    </div>
                    <p className="text-[12px] text-white/60 mt-2 leading-relaxed">
                      {concentration.topCustomers.share > 50
                        ? `Os 10% melhores clientes (${concentration.topCustomers.count} de ${concentration.topCustomers.total}) sustentam mais da metade da receita. Programa de fidelidade e atendimento VIP aqui é prioridade — perder um desses dói no caixa.`
                        : "Base de clientes bem distribuída — risco baixo de perder um cliente grande."}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <RecCard title="Carros para considerar vender" subtitle="Mais de 6 meses na frota com pouco uso e retorno baixo" icon={AlertTriangle} hue="rose" empty="Frota saudável — nenhum carro nessa situação."
                items={sellCandidates.map(p => ({ name: p.v.name || "—", right: `${p.occupancy.toFixed(0)}% de uso`, sub: `Já devolveu ${p.roi.toFixed(1)}% do investido · ${p.daysInFleet} dias na frota` }))} />
              <RecCard title="Carros que aguentam preço maior" subtitle="Estão sempre alugados — dá pra cobrar 12% a 18% a mais" icon={Flame} hue="amber" empty="Nenhum carro com demanda excedente."
                items={priceUpCandidates.map(p => ({ name: p.v.name || "—", right: `${p.occupancy.toFixed(0)}% de uso`, sub: `Hoje ${fmtUSD(p.daily)}/dia → testar ${fmtUSD(p.daily * 1.15)}/dia` }))} />
              <RecCard title="Carros parados — testar promo" subtitle="Pouco alugados há mais de 90 dias" icon={Snowflake} hue="amber" empty="Nenhum carro nessa situação."
                items={priceDownCandidates.map(p => ({ name: p.v.name || "—", right: `${p.occupancy.toFixed(0)}% de uso`, sub: `Hoje ${fmtUSD(p.daily)}/dia → testar ${fmtUSD(p.daily * 0.85)}/dia em promo` }))} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="ai-card">
                <CardHeader title="Os carros que mais geram dinheiro" sub="Quem mais retorna por dia que está na sua frota — vale a pena comprar parecidos" icon={Award} />
                <ul className="space-y-2.5">
                  {topStars.map(p => (
                    <li key={p.v.id} className="flex justify-between text-[12.5px]">
                      <div className="min-w-0">
                        <div className="text-white/90 truncate">{p.v.name}</div>
                        <div className="text-[10.5px] text-white/55">{p.bookingsCount} reservas · {p.customerCount} clientes diferentes</div>
                      </div>
                      <span className="tabular-nums text-emerald-200">{fmtUSD(p.revPerDayOwned)}/dia</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="ai-card">
                <CardHeader title="Categorias que mais dão dinheiro" sub="Receita por dia que o carro está na sua frota" icon={TrendingUp} />
                <ul className="space-y-2.5">
                  {byCategory.slice(0, 6).map(c => (
                    <li key={c.cat} className="text-[12.5px]">
                      <div className="flex justify-between"><span className="text-white/85">{c.cat}</span><span className="tabular-nums text-amber-200">{fmtUSD(c.rpd)}/dia</span></div>
                      <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full ai-bar-emerald" style={{ width: `${Math.min(c.avgOcc, 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="ai-card">
              <CardHeader title="Marcas com melhor desempenho" sub="Receita total e taxa de uso média" icon={Zap} />
              <ul className="space-y-2.5">
                {byBrand.slice(0, 6).map(b => (
                  <li key={b.brand} className="text-[12.5px]">
                    <div className="flex justify-between gap-2"><span className="text-white/85 truncate">{b.brand}</span><span className="tabular-nums text-emerald-200/90">{fmtUSD(b.revenue)}</span></div>
                    <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full ai-bar-emerald" style={{ width: `${Math.min(b.avgOcc, 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="ai-card">
          <CardHeader title="Carros com desempenho fraco" sub="Estão na frota há mais de 2 meses e geram pouco por dia" icon={Snowflake} />
          <ul className="space-y-2">
            {underperformers.map(p => (
              <li key={p.v.id} className="flex justify-between text-[12.5px]">
                <span className="text-white/85 truncate">{p.v.name}</span>
                <span className="tabular-nums text-rose-300">{fmtUSD(p.revPerDayOwned)}/dia · {p.occupancy.toFixed(0)}% de uso</span>
              </li>
            ))}
            {underperformers.length === 0 && <li className="text-white/55 text-xs">Frota equilibrada — nenhum carro com desempenho fraco.</li>}
          </ul>
        </div>
      </div>

      <style>{`
        .ai-shell { background: radial-gradient(ellipse at top, #0b1830 0%, #050813 55%, #02030a 100%); color: #e6f0ff; isolation: isolate; }
        .ai-bg-grid { position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background-image: linear-gradient(rgba(120,180,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(120,180,255,0.06) 1px, transparent 1px);
          background-size: 48px 48px; mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); }
        .ai-bg-glow { position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background: radial-gradient(600px circle at 20% 10%, rgba(80,140,255,0.25), transparent 60%),
                      radial-gradient(500px circle at 85% 15%, rgba(180,90,255,0.18), transparent 60%),
                      radial-gradient(700px circle at 60% 90%, rgba(20,200,200,0.15), transparent 60%); }
        .ai-bg-noise { position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: .035;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
        .ai-title { font-size: clamp(28px, 3vw, 38px); font-weight: 200; letter-spacing: -0.02em;
          background: linear-gradient(135deg, #ffffff 0%, #aac8ff 60%, #d4a8ff 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent; line-height: 1.05; }
        .ai-subtitle { font-size: 12.5px; color: rgba(230,240,255,0.55); margin-top: 6px; }
        .ai-badge { display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: 999px;
          background: linear-gradient(90deg, rgba(80,140,255,0.18), rgba(180,90,255,0.18));
          border: 1px solid rgba(120,180,255,0.35); font-size: 10px; letter-spacing: 0.22em; font-weight: 600; color: #c7e0ff; }
        .ai-pulse { width: 6px; height: 6px; border-radius: 50%; background: #5cffb0; box-shadow: 0 0 10px #5cffb0; animation: ai-pulse 1.6s ease-in-out infinite; }
        @keyframes ai-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
        .ai-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); font-size: 10.5px; color: rgba(230,240,255,0.7); }
        .ai-card { position: relative; padding: 18px; border-radius: 16px;
          background: linear-gradient(180deg, rgba(20,30,55,0.55), rgba(10,15,30,0.55));
          border: 1px solid rgba(120,180,255,0.12); backdrop-filter: blur(12px);
          box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 50px -20px rgba(0,0,0,0.6); }
        .ai-card::before { content:""; position:absolute; inset:0; border-radius:16px; pointer-events:none;
          background: linear-gradient(135deg, rgba(120,180,255,0.18), transparent 40%);
          mask: linear-gradient(black,black) content-box, linear-gradient(black,black);
          mask-composite: exclude; -webkit-mask-composite: xor; padding: 1px; }
        .ai-card-title { font-size: 13px; font-weight: 500; color: #eaf2ff; letter-spacing: -0.005em; }
        .ai-card-sub { font-size: 10.5px; color: rgba(230,240,255,0.5); margin-top: 2px; }
        .ai-bar { background: linear-gradient(180deg, rgba(120,180,255,0.9), rgba(60,100,200,0.5)); box-shadow: 0 0 18px rgba(120,180,255,0.4); }
        .ai-bar-hot { background: linear-gradient(180deg, #ffd27a, #ff7a5c); box-shadow: 0 0 22px rgba(255,170,90,0.55); }
        .ai-bar-emerald { background: linear-gradient(90deg, rgba(92,255,176,0.9), rgba(60,200,140,0.4)); }
        .ai-heat { background: linear-gradient(180deg, rgba(120,180,255,0.95), rgba(180,90,255,0.6)); box-shadow: 0 0 14px rgba(120,180,255,0.35); }
        .ai-insight { padding: 16px 18px; border-radius: 14px;
          background: linear-gradient(135deg, rgba(40,80,180,0.25), rgba(120,40,180,0.18));
          border: 1px solid rgba(120,180,255,0.25); }
        .ai-insight-icon { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center;
          background: linear-gradient(135deg, rgba(120,180,255,0.4), rgba(180,120,255,0.4));
          color: #fff; box-shadow: 0 0 18px rgba(120,180,255,0.45); }
        .ai-tabs { display: flex; gap: 6px; padding: 4px; border-radius: 12px;
          background: rgba(10,15,30,0.5); border: 1px solid rgba(120,180,255,0.12); overflow-x: auto; }
        .ai-tab { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px;
          font-size: 11.5px; letter-spacing: 0.05em; color: rgba(230,240,255,0.65); white-space: nowrap;
          border: 1px solid transparent; transition: all .2s; }
        .ai-tab:hover { color: #fff; background: rgba(120,180,255,0.06); }
        .ai-tab-active { color: #fff; background: linear-gradient(135deg, rgba(120,180,255,0.22), rgba(180,120,255,0.18));
          border-color: rgba(120,180,255,0.35); box-shadow: 0 0 18px rgba(120,180,255,0.25); }
        .ai-alert { padding: 12px; border-radius: 12px; background: rgba(20,30,55,0.55);
          border: 1px solid rgba(255,255,255,0.06); }
        .ai-alert-high { border-color: rgba(255,120,140,0.35); background: linear-gradient(135deg, rgba(120,30,50,0.35), rgba(20,30,55,0.55)); }
        .ai-alert-med { border-color: rgba(255,200,90,0.3); background: linear-gradient(135deg, rgba(120,80,20,0.3), rgba(20,30,55,0.55)); }
      `}</style>
    </div>
  );
}

/* ───── Reusable bits ───── */
function CardHeader({ title, sub, icon: Icon }: { title: string; sub: string; icon: typeof Brain }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div><h3 className="ai-card-title">{title}</h3><p className="ai-card-sub">{sub}</p></div>
      <Icon size={14} className="text-cyan-300/70" />
    </div>
  );
}

function KpiBlock({ title, value, sub, icon: Icon }: { title: string; value: string; sub: string; icon: typeof Brain }) {
  return (
    <div className="ai-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/55">{title}</span>
        <Icon size={13} className="text-cyan-300/70" />
      </div>
      <div className="text-2xl font-light text-white/95 tabular-nums">{value}</div>
      <div className="text-[10.5px] text-white/50 mt-1">{sub}</div>
    </div>
  );
}

function FunnelBar({ label, value, max, hue }: { label: string; value: number; max: number; hue: "violet" | "cyan" | "amber" | "emerald" | "rose" }) {
  const bg = { violet: "rgba(180,120,255,0.7)", cyan: "rgba(120,220,255,0.7)", amber: "rgba(255,200,120,0.7)", emerald: "rgba(120,255,180,0.7)", rose: "rgba(255,140,160,0.7)" }[hue];
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="text-[12px] mb-2">
      <div className="flex justify-between text-white/80"><span>{label}</span><span className="tabular-nums">{value}</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div style={{ width: `${pct}%`, background: bg, boxShadow: `0 0 10px ${bg}` }} className="h-full transition-all" />
      </div>
    </div>
  );
}

function ChannelBar({ label, value, total, hue }: { label: string; value: number; total: number; hue: "cyan" | "violet" | "amber" }) {
  const bg = { cyan: "rgba(120,220,255,0.8)", violet: "rgba(180,120,255,0.8)", amber: "rgba(255,200,120,0.8)" }[hue];
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="text-[12px] mb-2">
      <div className="flex justify-between text-white/85"><span>{label}</span><span className="tabular-nums">{fmtUSD(value)} · {pct.toFixed(0)}%</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div style={{ width: `${pct}%`, background: bg, boxShadow: `0 0 10px ${bg}` }} className="h-full transition-all" />
      </div>
    </div>
  );
}

function AiKpi({ label, sub, value, icon: Icon, hue }: { label: string; sub?: string; value: string; icon: typeof Brain; hue: "amber" | "emerald" | "cyan" | "violet" | "rose" }) {
  const hueMap = {
    amber:   { txt: "text-amber-200",   glow: "rgba(255,180,80,0.35)"   },
    emerald: { txt: "text-emerald-200", glow: "rgba(92,255,176,0.35)"   },
    cyan:    { txt: "text-cyan-200",    glow: "rgba(120,220,255,0.35)"  },
    violet:  { txt: "text-violet-200",  glow: "rgba(200,140,255,0.35)"  },
    rose:    { txt: "text-rose-200",    glow: "rgba(255,140,160,0.35)"  },
  }[hue];
  return (
    <div className="ai-card" style={{ boxShadow: `0 20px 60px -30px ${hueMap.glow}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/55">{label}</span>
        <Icon size={13} className={hueMap.txt} />
      </div>
      <div className={`text-3xl font-light tabular-nums ${hueMap.txt}`} style={{ textShadow: `0 0 24px ${hueMap.glow}` }}>{value}</div>
      {sub && <div className="text-[10.5px] text-white/50 mt-1">{sub}</div>}
    </div>
  );
}

function RecCard({ title, subtitle, icon: Icon, hue, items, empty }: {
  title: string; subtitle: string; icon: typeof Brain;
  hue: "rose" | "amber" | "emerald";
  items: { name: string; right: string; sub: string }[]; empty: string;
}) {
  const c = { rose: { i: "text-rose-300", a: "text-rose-200/90" }, amber: { i: "text-amber-300", a: "text-amber-200/90" }, emerald: { i: "text-emerald-300", a: "text-emerald-200/90" } }[hue];
  return (
    <div className="ai-card">
      <div className="flex items-center justify-between mb-4">
        <div><h3 className="ai-card-title">{title}</h3><p className="ai-card-sub">{subtitle}</p></div>
        <Icon size={14} className={c.i} />
      </div>
      {items.length === 0 ? <p className="text-white/50 text-xs">{empty}</p> : (
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="text-[12.5px]">
              <div className="flex items-center justify-between gap-2"><span className="text-white/90 truncate">{it.name}</span><span className={`tabular-nums ${c.a}`}>{it.right}</span></div>
              <div className="text-[10.5px] text-white/50 mt-0.5">{it.sub}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ptSegment(s: string): string {
  switch (s) {
    case "Champion": return "Fiel VIP";
    case "Loyal": return "Recorrente";
    case "At Risk": return "Em risco";
    case "Hibernating": return "Adormecido";
    case "New": return "Novo";
    default: return s;
  }
}

function localBriefing(p: any): string {
  const parts: string[] = [];
  if (p.pacing) {
    const sinal = p.pacing.delta >= 0 ? "acima" : "abaixo";
    parts.push(`Este mês você já faturou ${fmtUSD(p.pacing.mtd)}, ficando ${Math.abs(p.pacing.delta).toFixed(0)}% ${sinal} do mesmo dia do mês passado (${fmtUSD(p.pacing.lmtd)}).`);
  }
  if (p.avgOccupancy !== undefined) {
    if (p.avgOccupancy < 40) parts.push(`A frota está alugada apenas ${p.avgOccupancy.toFixed(0)}% do tempo — o foco agora deve ser atrair mais clientes antes de comprar carros novos.`);
    else if (p.avgOccupancy > 70) parts.push(`Os carros estão alugados ${p.avgOccupancy.toFixed(0)}% do tempo — é o momento certo de aumentar preço.`);
    else parts.push(`Ocupação está em ${p.avgOccupancy.toFixed(0)}% — saudável, com espaço para ajustes pontuais.`);
  }
  if (p.revPAC) parts.push(`Cada carro está gerando em média ${fmtUSD2(p.revPAC)} por dia que está na sua frota — use isso como referência ao avaliar a compra de um carro novo.`);
  if (p.sellCandidatesCount) parts.push(`Existem ${p.sellCandidatesCount} carro(s) com pouco uso e baixo retorno que valem ser considerados para venda.`);
  if (p.priceUpCount) parts.push(`${p.priceUpCount} carro(s) estão sempre alugados e aguentam um aumento de preço entre 12% e 18%.`);
  if (p.opportunityWindows) parts.push(`Encontrei ${p.opportunityWindows} períodos curtos de carros parados entre reservas — uma promo de última hora pode capturar essa receita.`);
  if (p.champions || p.atRisk) parts.push(`Você tem ${p.champions ?? 0} clientes Fiéis VIP que sustentam a recorrência${p.atRisk ? ` e ${p.atRisk} cliente(s) Em risco que merecem uma mensagem` : ""}.`);
  if (p.topCategory) parts.push(`A categoria que mais rende hoje é ${p.topCategory}.`);
  return parts.join(" ");
}

