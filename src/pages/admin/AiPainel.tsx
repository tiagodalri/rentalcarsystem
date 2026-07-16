import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseDateOnly } from "@/lib/dateOnly";
import {
  Brain, Sparkles, TrendingUp, AlertTriangle, Target, Zap, DollarSign,
  Activity, Gauge, Award, Flame, Snowflake, Layers, Rocket, Users,
  Clock, ShieldAlert, Calendar, LineChart, Wallet, ArrowDownRight,
  ArrowUpRight, Repeat, Wand2, Sun, HeartHandshake, TimerReset, CalendarDays,
  CircleDollarSign, Lightbulb, Gamepad2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { computePerVehicle } from "@/lib/aiStudio/perVehicle";
import { AiBriefingCard, type BriefingSnapshot, type BriefingHighlight, type BriefingAction } from "@/components/admin/ai-studio/AiBriefingCard";
import type { FleetReport } from "@/lib/exportFleetReportPdf";

import { findBrandByName } from "@/data/carBrands";
import {
  differenceInDays, startOfMonth, endOfMonth, subMonths, format,
  startOfDay, addDays, isSameDay,
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

type TabKey = "revenue" | "demand" | "operations" | "financial" | "strategy";

export default function AiPainel({
  bookings, vehicles, briefingOnly = false, hideBriefing = false,
}: { bookings: Booking[]; vehicles: Vehicle[]; briefingOnly?: boolean; hideBriefing?: boolean }) {
  const navigate = useNavigate();
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

  /* ───── Per-vehicle analytics — centralizado em src/lib/aiStudio/perVehicle.ts ───── */
  const perVehicle = useMemo(
    () => computePerVehicle(vehicles as any, realBookings as any, expenses as any, today),
    [vehicles, realBookings, expenses, today],
  );


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
    p.daysInFleet > 180 && p.occupancy < 35 && p.purchase > 0 && p.roi < 15 && p.hasAcquiredDate
  ).sort((a, b) => a.roi - b.roi).slice(0, 5);
  // Subir preço: precisa de histórico real (>= 60 dias) e ocupação alta validada
  const priceUpCandidates = perVehicle.filter(p =>
    p.occupancy >= 70 && p.occupancy <= 100 && p.bookingsCount >= 3 &&
    p.daysInFleet >= 60 && p.hasAcquiredDate && p.daily > 0
  ).sort((a, b) => b.occupancy - a.occupancy).slice(0, 5);
  const priceDownCandidates = perVehicle.filter(p =>
    p.occupancy < 25 && p.daysInFleet > 90 && p.daily > 0 && p.hasAcquiredDate
  ).sort((a, b) => a.occupancy - b.occupancy).slice(0, 5);


  /* ───── Sugestões de troca: pareia underperformer com top-star de valor parecido ───── */
  const swapSuggestions = useMemo(() => {
    // ROI anualizado (%/ano): normaliza pelo tempo de posse — o que o cliente entende como "retorno".
    const annualROI = (p: typeof perVehicle[number]) => {
      if (!p.purchase || p.purchase <= 0) return 0;
      const yrs = Math.max(p.daysInFleet / 365, 0.25);
      return ((p.revenue - p.exp) / p.purchase) * 100 / yrs;
    };
    const stars = [...perVehicle]
      .filter(p => p.daysInFleet > 60 && p.revPerDayOwned > 0 && p.purchase > 0)
      .sort((a, b) => b.revPerDayOwned - a.revPerDayOwned)
      .slice(0, 10);
    const weak = [...perVehicle]
      .filter(p => p.daysInFleet > 120 && p.occupancy < 35 && p.purchase > 0)
      .sort((a, b) => a.revPerDayOwned - b.revPerDayOwned)
      .slice(0, 4);
    return weak.map(w => {
      // Prioridade de match: mesma categoria + valor parecido (±40%); depois mesma categoria;
      // depois valor parecido; depois melhor star geral.
      const priceClose = (s: typeof perVehicle[number]) =>
        Math.abs(s.purchase - w.purchase) / w.purchase <= 0.4;
      const sameCatPrice = stars.find(s => s.v.id !== w.v.id && (s.v.category || "—") === (w.v.category || "—") && priceClose(s));
      const sameCat = stars.find(s => s.v.id !== w.v.id && (s.v.category || "—") === (w.v.category || "—"));
      const anyPrice = stars.find(s => s.v.id !== w.v.id && priceClose(s));
      const best = stars.find(s => s.v.id !== w.v.id);
      const match = sameCatPrice || sameCat || anyPrice || best;
      if (!match) return null;
      const upliftPerDay = Math.max(match.revPerDayOwned - w.revPerDayOwned, 0);
      const annualUplift = upliftPerDay * 365;
      const wROI = annualROI(w);
      const sROI = annualROI(match);
      const multiple = wROI > 0 ? sROI / wROI : (sROI > 0 ? Infinity : 0);
      const reason = sameCatPrice
        ? `${w.v.category || "categoria parecida"}, valor parecido`
        : sameCat
        ? `mesma categoria (${w.v.category || "—"})`
        : anyPrice
        ? "valor de compra parecido"
        : "melhor desempenho da frota";

      // Frases mastigadas de venda (5 partes)
      const daysIdle = w.daysSinceLastBooking ?? w.daysInFleet;
      const wDays = Math.max(w.daysInFleet, 1);
      const sDays = Math.max(match.daysInFleet, 1);
      const lines = [
        `Esta ${w.v.name} está há ${daysIdle} dias sem nenhuma locação.`,
        `No histórico rendeu em média só ${fmtUSD(w.revPerDayOwned)}/dia na frota (= ${w.bookingsCount} locaç${w.bookingsCount === 1 ? "ão" : "ões"} somando ${fmtUSD(w.revenue)} em ${wDays} dias de posse).`,
        `Ela custou ${fmtUSD(w.purchase)} — isso dá só ${wROI.toFixed(1)}% de retorno ao ano.`,
        `Uma ${match.v.name} parecida (${reason}, custou ${fmtUSD(match.purchase)}) rende ${fmtUSD(match.revPerDayOwned)}/dia = ${sROI.toFixed(1)}% ao ano${
          isFinite(multiple) && multiple >= 1.5 ? `, quase ${multiple.toFixed(1)}× mais retorno sobre investimento parecido` : ""
        }.`,
        `+${fmtUSD(annualUplift)}/ano se trocar.`,
      ];

      return { weak: w, star: match, upliftPerDay, annualUplift, reason, wROI, sROI, multiple, lines };
    }).filter(Boolean) as Array<{
      weak: typeof perVehicle[number]; star: typeof perVehicle[number];
      upliftPerDay: number; annualUplift: number; reason: string;
      wROI: number; sROI: number; multiple: number; lines: string[];
    }>;
  }, [perVehicle]);

  /* ───── Projeção Futura: e se você trocasse os fracos pelos campeões? ─────
     Usa SOMENTE carros com histórico real (>= 60 dias na frota e dado de aquisição)
     para evitar projeções em cima de ruído. */
  const fleetProjection = useMemo(() => {
    const eligible = perVehicle.filter(p => p.hasAcquiredDate && p.daysInFleet >= 60);
    if (eligible.length < 4) return null;

    // Top 25% (mín 2) viram referência de "estrela"
    const sorted = [...eligible].sort((a, b) => b.revPerDayOwned - a.revPerDayOwned);
    const starCount = Math.max(2, Math.ceil(sorted.length * 0.25));
    const stars = sorted.slice(0, starCount);
    const starAvgRevPerDay = stars.reduce((s, p) => s + p.revPerDayOwned, 0) / stars.length;
    const starAvgOccupancy = stars.reduce((s, p) => s + p.occupancy, 0) / stars.length;
    const starAvgROIAnnualized = stars.reduce((s, p) => {
      // ROI anualizado pela base de dias na frota
      const yrs = Math.max(p.daysInFleet / 365, 0.25);
      return s + (p.roi / yrs);
    }, 0) / stars.length;

    // Carros fracos = bottom 25% (mín 2) com ocupação < 45%
    const weakAll = [...sorted].reverse().filter(p => p.occupancy < 45);
    const weakCount = Math.min(weakAll.length, Math.max(2, Math.ceil(sorted.length * 0.25)));
    const weak = weakAll.slice(0, weakCount);
    if (weak.length === 0) return null;

    const weakCapital = weak.reduce((s, p) => s + p.purchase, 0);
    const weakRevPerDay = weak.reduce((s, p) => s + p.revPerDayOwned, 0);
    const weakAvgOccupancy = weak.reduce((s, p) => s + p.occupancy, 0) / weak.length;

    // Cenário: substituir cada fraco por um carro com performance média das estrelas
    const projectedRevPerDay = starAvgRevPerDay * weak.length;
    const upliftPerDay = Math.max(projectedRevPerDay - weakRevPerDay, 0);

    const horizons = [
      { label: "90 dias",     days: 90  },
      { label: "6 meses",     days: 180 },
      { label: "12 meses",    days: 365 },
    ].map(h => ({
      label: h.label,
      days: h.days,
      currentRevenue:    weakRevPerDay      * h.days,
      projectedRevenue:  projectedRevPerDay * h.days,
      uplift:            upliftPerDay       * h.days,
    }));

    // Aproveitamento de capital: quanto a mais o mesmo dinheiro investido rende
    const currentAnnualOnWeak    = weakRevPerDay      * 365;
    const projectedAnnualOnWeak  = projectedRevPerDay * 365;
    const capitalEfficiencyGain  = currentAnnualOnWeak > 0
      ? ((projectedAnnualOnWeak - currentAnnualOnWeak) / currentAnnualOnWeak) * 100
      : 0;

    // Payback médio do "carro estrela" — referência pra trocar com segurança
    const starPaybacks = stars
      .map(p => p.paybackMonths)
      .filter((x): x is number => typeof x === "number" && x > 0);
    const avgStarPayback = starPaybacks.length
      ? starPaybacks.reduce((a, b) => a + b, 0) / starPaybacks.length
      : null;

    return {
      stars, weak, weakCapital,
      starAvgRevPerDay, starAvgOccupancy, starAvgROIAnnualized,
      weakRevPerDay, weakAvgOccupancy,
      upliftPerDay, horizons,
      capitalEfficiencyGain,
      avgStarPayback,
    };
  }, [perVehicle]);






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
    const out: { label: string; revenue: number; bookings: number; date: Date; isCurrent: boolean }[] = [];
    for (let i = 5; i >= 0; i--) {
      const anchor = startOfMonth(subMonths(today, i));
      const isCurrent = i === 0;
      // Mes corrente: fecha em HOJE (MTD), casando com o KPI "Receita do mes ate hoje".
      // Meses anteriores: fecham no ultimo dia do mes.
      const end = isCurrent ? today : endOfMonth(anchor);
      const inM = realBookings.filter(b => {
        const d = parseDateOnly(b.pickup_date);
        return d >= anchor && d <= end;
      });
      out.push({
        label: format(anchor, "MMM", { locale: ptBR }),
        date: anchor,
        revenue: inM.reduce((s, b) => s + (Number(b.total_price) || 0), 0),
        bookings: inM.length,
        isCurrent,
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
      const d = parseDateOnly(b.pickup_date);
      return d >= mtdStart && d <= today;
    }).reduce((s, b) => s + (Number(b.total_price) || 0), 0);
    const lmtd = realBookings.filter(b => {
      const d = parseDateOnly(b.pickup_date);
      return d >= lastMonthStart && d <= lastMonthSameDay;
    }).reduce((s, b) => s + (Number(b.total_price) || 0), 0);
    const delta = lmtd > 0 ? ((mtd - lmtd) / lmtd) * 100 : 0;
    return { mtd, lmtd, delta };
  }, [realBookings, today]);

  /* ───── Cash pipelines ───── */
  const next30 = useMemo(() => {
    const horizon = addDays(today, 30);
    return realBookings.filter(b => {
      const d = parseDateOnly(b.pickup_date);
      return d >= today && d <= horizon;
    }).reduce((s, b) => s + (Number(b.total_price) || 0), 0);
  }, [realBookings, today]);
  const next60 = useMemo(() => {
    const horizon = addDays(today, 60);
    return realBookings.filter(b => {
      const d = parseDateOnly(b.pickup_date);
      return d >= today && d <= horizon;
    }).reduce((s, b) => s + (Number(b.total_price) || 0), 0);
  }, [realBookings, today]);

  /* ───── Booking lead time ───── */
  const leadTime = useMemo(() => {
    const ds: number[] = [];
    realBookings.forEach(b => {
      if (!b.created_at) return;
      const lt = differenceInDays(parseDateOnly(b.pickup_date), new Date(b.created_at));
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
      const d = parseDateOnly(b.pickup_date);
      arr[d.getDay()] += 1;
    });
    const max = Math.max(...arr, 1);
    const labels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    return arr.map((v, i) => ({ label: labels[i], v, pct: (v / max) * 100 }));
  }, [realBookings]);

  /* ───── HOJE NA SUA FROTA ───── */
  const todayStats = useMemo(() => {
    const tomorrow = addDays(today, 1);
    const rodandoAgora = realBookings.filter(b => {
      const p = startOfDay(parseDateOnly(b.pickup_date));
      const r = startOfDay(parseDateOnly(b.return_date));
      return p <= today && r >= today && ["confirmed", "active", "in_progress"].includes(b.status);
    });
    const saemHoje = realBookings.filter(b => isSameDay(startOfDay(parseDateOnly(b.pickup_date)), today));
    const voltamHoje = realBookings.filter(b => isSameDay(startOfDay(parseDateOnly(b.return_date)), today));
    const saemAmanha = realBookings.filter(b => isSameDay(startOfDay(parseDateOnly(b.pickup_date)), tomorrow));
    const receitaHoje = rodandoAgora.reduce((s, b) => {
      const nights = Math.max(differenceInDays(parseDateOnly(b.return_date), parseDateOnly(b.pickup_date)), 1);
      const daily = (Number(b.total_price) || 0) / nights;
      return s + daily;
    }, 0);
    const paradosAgora = vehicles.filter(v => v.status !== "sold" && !rodandoAgora.some(b => b.vehicle_id === v.id));
    return { rodandoAgora: rodandoAgora.length, saemHoje: saemHoje.length, voltamHoje: voltamHoje.length, saemAmanha: saemAmanha.length, receitaHoje, paradosAgora: paradosAgora.length };
  }, [realBookings, vehicles, today]);


  /* ───── PAYBACK MÉDIO & FIDELIDADE ───── */
  const paybackAvg = useMemo(() => {
    const list = perVehicle.filter(p => p.paybackMonths !== null && p.paybackMonths > 0);
    if (!list.length) return null;
    return Math.round(list.reduce((s, p) => s + (p.paybackMonths || 0), 0) / list.length);
  }, [perVehicle]);

  /* ───── RECEITA POR DIA DA SEMANA ───── */
  const dowRevenue = useMemo(() => {
    const arr = [0, 0, 0, 0, 0, 0, 0];
    const cnt = [0, 0, 0, 0, 0, 0, 0];
    realBookings.forEach(b => {
      const d = parseDateOnly(b.pickup_date);
      const idx = d.getDay();
      arr[idx] += Number(b.total_price) || 0;
      cnt[idx] += 1;
    });
    const labels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    const data = arr.map((v, i) => ({ label: labels[i], rev: v, cnt: cnt[i], avg: cnt[i] ? v / cnt[i] : 0 }));
    const max = Math.max(...data.map(d => d.rev), 1);
    const best = [...data].sort((a, b) => b.rev - a.rev)[0];
    const worst = [...data].filter(d => d.cnt > 0).sort((a, b) => a.rev - b.rev)[0];
    return { data, max, best, worst };
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
        .filter(b => b.vehicle_id === v.id && parseDateOnly(b.return_date) >= today)
        .sort((a, b) => parseDateOnly(a.pickup_date).getTime() - parseDateOnly(b.pickup_date).getTime());
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

  /* ───── RECEITA PERDIDA — cancelamentos + janelas ociosas ───── */
  const lostRevenue = useMemo(() => {
    const cancelado = bookings.filter(b => b.status === "cancelled").reduce((s, b) => s + (Number(b.total_price) || 0), 0);
    const janelas = opportunityWindows.reduce((s, w) => s + w.estLoss, 0);
    return { cancelado, janelas, total: cancelado + janelas };
  }, [bookings, opportunityWindows]);


  /* ───── Customers: RFM-like ───── */
  const customers = useMemo(() => {
    const map = new Map<string, { name: string; trips: number; revenue: number; lastDate: Date | null; firstDate: Date | null }>();
    realBookings.forEach(b => {
      const key = b.customer_id || b.customer_name || "—";
      const cur = map.get(key) || { name: b.customer_name || "—", trips: 0, revenue: 0, lastDate: null, firstDate: null };
      cur.trips += 1;
      cur.revenue += Number(b.total_price) || 0;
      const d = parseDateOnly(b.pickup_date);
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

  /* ───── CONSELHOS DA SEMANA — ações priorizadas pela IA ───── */
  type Decision = {
    titulo: string; descricao: string; impacto: string; impactoValor: number;
    prioridade: "alta" | "media" | "baixa"; categoria: "Preço" | "Frota" | "Cliente" | "Oportunidade" | "Risco";
  };
  const weeklyDecisions = useMemo<Decision[]>(() => {
    const out: Decision[] = [];
    priceUpCandidates.slice(0, 2).forEach(p => {
      const ganhoMes = p.daily * 0.15 * 20;
      out.push({
        titulo: `Suba o preço da ${p.v.name}`,
        descricao: `Está alugada ${p.occupancy.toFixed(0)}% do tempo. Testar ${fmtUSD(p.daily * 1.15)}/dia (hoje ${fmtUSD(p.daily)}/dia).`,
        impacto: `+${fmtUSD(ganhoMes)}/mês estimado`, impactoValor: ganhoMes,
        prioridade: "alta", categoria: "Preço",
      });
    });
    swapSuggestions.slice(0, 1).forEach(s => {
      out.push({
        titulo: `Avalie trocar a ${s.weak.v.name}`,
        descricao: s.lines.join(" "),
        impacto: `+${fmtUSD(s.annualUplift)}/ano estimado`, impactoValor: s.annualUplift / 12,
        prioridade: "alta", categoria: "Frota",
      });
    });
    opportunityWindows.slice(0, 2).forEach(w => {
      out.push({
        titulo: `Promova a ${w.vehicle} entre reservas`,
        descricao: `Carro vai ficar ${w.nights} dias parado entre ${format(w.gapStart, "dd/MM")} e ${format(w.gapEnd, "dd/MM")}. Promo de última hora.`,
        impacto: `Recupere até ${fmtUSD(w.estLoss)}`, impactoValor: w.estLoss,
        prioridade: "media", categoria: "Oportunidade",
      });
    });
    priceDownCandidates.slice(0, 1).forEach(p => {
      out.push({
        titulo: `Teste promo na ${p.v.name}`,
        descricao: `Pouquíssimo uso (${p.occupancy.toFixed(0)}%) e ${p.daysSinceLastBooking ?? '—'} dias sem receber. ${fmtUSD(p.daily * 0.85)}/dia por 14 dias para gerar demanda.`,
        impacto: `Cada dia parado custa ${fmtUSD(p.daily * 0.7)}`, impactoValor: p.daily * 0.7 * 7,
        prioridade: "baixa", categoria: "Preço",
      });
    });
    if (pacing.delta < -15) {
      out.unshift({
        titulo: "Receita do mês está caindo",
        descricao: `${pacing.delta.toFixed(0)}% abaixo do mesmo dia do mês passado. Verifique campanhas ativas e visibilidade da frota nos canais.`,
        impacto: `Diferença atual: ${fmtUSD(pacing.lmtd - pacing.mtd)}`, impactoValor: pacing.lmtd - pacing.mtd,
        prioridade: "alta", categoria: "Risco",
      });
    }
    return out.sort((a, b) => {
      const pri = { alta: 0, media: 1, baixa: 2 };
      if (pri[a.prioridade] !== pri[b.prioridade]) return pri[a.prioridade] - pri[b.prioridade];
      return b.impactoValor - a.impactoValor;
    }).slice(0, 6);
  }, [priceUpCandidates, priceDownCandidates, swapSuggestions, opportunityWindows, churnRisks, pacing]);


  /* ───── Operations ───── */
  const turnaround = useMemo(() => {
    const gaps: number[] = [];
    vehicles.forEach(v => {
      const list = realBookings.filter(b => b.vehicle_id === v.id)
        .sort((a, b) => parseDateOnly(a.pickup_date).getTime() - parseDateOnly(b.pickup_date).getTime());
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
        else if (z > 1.5) list.push({ label: "Receita do mês", severity: "med", msg: `Receita ${(((cur.revenue - mean) / mean) * 100).toFixed(0)}% acima da média. Momento de capturar mais demanda.` });
      }
    }
    const cancelRate = funnel.total > 0 ? (funnel.cancelled / funnel.total) * 100 : 0;
    if (cancelRate > 20) list.push({ label: "Cancelamentos", severity: "high", msg: `Taxa de cancelamento em ${cancelRate.toFixed(1)}%. Investigar causas operacionais.` });
    if (avgOccupancy < 30) list.push({ label: "Ocupação", severity: "high", msg: `Ocupação média em ${avgOccupancy.toFixed(0)}%. Frota com capacidade ociosa significativa.` });
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
        const topRevCars = [...perVehicle]
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
          .map(p => ({
            nome: p.v.name,
            categoria: p.v.category,
            marca: p.v.brand,
            adquiridoEm: p.v.acquired_date,
            diasNaFrota: p.daysInFleet,
            investido: Math.round(p.purchase),
            receita: Math.round(p.revenue),
            despesas: Math.round(p.exp),
            lucro: Math.round(p.profit),
            retornoPct: Math.round(p.roi),
            ocupacaoPct: Math.round(p.occupancy),
            receitaPorDiaDePosse: Math.round(p.revPerDayOwned),
            diariaMedia: Math.round(p.adr),
          }));
        const piorRetorno = [...perVehicle]
          .filter(p => p.purchase > 0 && p.daysInFleet > 60)
          .sort((a, b) => a.roi - b.roi)
          .slice(0, 5)
          .map(p => ({
            nome: p.v.name,
            adquiridoEm: p.v.acquired_date,
            diasNaFrota: p.daysInFleet,
            investido: Math.round(p.purchase),
            receita: Math.round(p.revenue),
            retornoPct: Math.round(p.roi),
            ocupacaoPct: Math.round(p.occupancy),
          }));
        const trocasSugeridas = swapSuggestions.slice(0, 3).map(s => ({
          trocar: s.weak.v.name,
          por: `algo como ${s.star.v.name}`,
          ganhoAnualEstimado: Math.round(s.annualUplift),
          motivo: s.reason,
        }));
        const payload = {
          frota: {
            tamanho: perVehicle.length,
            totalInvestido: Math.round(fleetInvested),
            receitaTotal: Math.round(fleetRevenue),
            despesasTotal: Math.round(fleetExpenses),
            lucroTotal: Math.round(fleetRevenue - fleetExpenses),
            retornoMedioPct: Math.round(fleetROI),
            diariaMedia: Math.round(fleetADR),
            receitaPorCarroDia: Math.round(revPAC),
            ocupacaoMediaPct: Math.round(avgOccupancy),
            margemPct: Math.round(fleetMargin),
            idadeMediaDias: perVehicle.length
              ? Math.round(perVehicle.reduce((s, p) => s + p.daysInFleet, 0) / perVehicle.length)
              : 0,
          },
          concentracaoReceita: concentration ? {
            carrosQueGeram80Pct: concentration.topForRev.length,
            totalDeCarros: concentration.totalCount,
            percentualDosCarros: Math.round(concentration.topCountShare),
            percentualDoInvestimento: Math.round(concentration.topInvShare),
            ocupacaoMediaDessesCarros: Math.round(concentration.topAvgOcc),
            ocupacaoMediaDosOutros: Math.round(concentration.tailAvgOcc),
            marcaQueMaisGera: concentration.topBrand,
          } : null,
          mesAtual: {
            entrouAteHoje: Math.round(pacing.mtd),
            mesmoDiaMesPassado: Math.round(pacing.lmtd),
            variacaoPct: Math.round(pacing.delta),
          },
          tendencia6Meses: monthlyTrend.map(m => ({
            mes: m.label, receita: Math.round(m.revenue), reservas: m.bookings,
          })),
          pipelineFuturo: {
            proximos30Dias: Math.round(next30),
            proximos60Dias: Math.round(next60),
          },
          comportamento: {
            antecedenciaMediaDias: Math.round(leadTime.avg),
            tempoMedioParado: Math.round(turnaround.avg),
            diaMaisForte: dowHeat.reduce((a, b) => a.v > b.v ? a : b).label,
          },
          categoriasTop: byCategory.slice(0, 3).map(c => ({
            categoria: c.cat, receita: Math.round(c.revenue),
            ocupacaoMediaPct: Math.round(c.avgOcc),
          })),
          top5GeradoresDeReceita: topRevCars,
          piorRetorno,
          janelasOciosas: opportunityWindows.slice(0, 3).map(w => ({
            carro: w.vehicle, dias: w.nights, perdaEstimada: Math.round(w.estLoss),
          })),
          candidatosParaVender: sellCandidates.length,
          candidatosSubirPreco: priceUpCandidates.length,
          candidatosBaixarPreco: priceDownCandidates.length,
          trocasSugeridas,
          alertas: anomalies.map(a => a.msg),
          funilReservas: funnel,
          hojeNaFrota: todayStats,
          receitaPerdida: {
            cancelamentos: Math.round(lostRevenue.cancelado),
            janelasOciosas: Math.round(lostRevenue.janelas),
            total: Math.round(lostRevenue.total),
          },
          velocidadePagamentoMesesMedia: paybackAvg,
          receitaPorDiaDaSemana: dowRevenue.data.map(d => ({ dia: d.label, receita: Math.round(d.rev), reservas: d.cnt })),
          melhorDiaSemana: dowRevenue.best?.label,
          piorDiaSemana: dowRevenue.worst?.label,
          conselhosLocais: weeklyDecisions.map(d => ({
            titulo: d.titulo, descricao: d.descricao, impacto: d.impacto, prioridade: d.prioridade,
          })),
        };
        const { data, error } = await supabase.functions.invoke("intelligence-summary", { body: payload });
        if (!error && (data as any)?.text) setBriefing((data as any).text as string);
        else setBriefing(localBriefing(payload));
      } catch {
        setBriefing(localBriefing({
          fleetROI, avgOccupancy, revPAC, fleetADR, fleetMargin,
          pacing, sellCandidatesCount: sellCandidates.length,
          priceUpCount: priceUpCandidates.length,
          opportunityWindows: opportunityWindows.length,
          topCategory: byCategory[0]?.cat, topStar: topStars[0]?.v.name,
        }));
      } finally { setBriefingLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perVehicle.length]);

  const tabs: { key: TabKey; label: string; icon: typeof Brain }[] = [
    { key: "revenue", label: "Receita", icon: DollarSign },
    { key: "demand", label: "Reservas", icon: Activity },
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
        {/* Header — apenas contagem de carros/reservas (Simulador agora vive no Hub AI Studio) */}
        <div className="flex items-center justify-end gap-3 flex-wrap pt-1">
          <p className="ai-subtitle m-0 shrink-0 text-right">
            {perVehicle.length} carros · {realBookings.length} reservas
          </p>
        </div>


        {/* HERO BLOCK — 4 indicadores de venda (Pareto, Dinheiro perdido, Campeão×Pior, Margem) */}
        {!briefingOnly && (() => {
          const heroChampion = [...perVehicle]
            .filter(p => p.purchase > 0 && p.daysInFleet > 30 && p.revenue > 0)
            .sort((a, b) => b.roi - a.roi)[0] || null;
          const heroWorst = [...perVehicle]
            .filter(p => p.purchase > 0 && p.daysInFleet > 60)
            .sort((a, b) => a.roi - b.roi)[0] || null;
          const paretoCars = concentration?.topForRev.length ?? 0;
          const paretoShare = Math.round(concentration?.topRevShare ?? 0);
          const paretoTail = concentration?.tail.length ?? 0;
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <HeroKpi
                eyebrow="Concentração de receita"
                big={`${paretoShare}%`}
                headline={`da receita vem de ${paretoCars} carro${paretoCars === 1 ? "" : "s"}`}
                sub={`Os outros ${paretoTail} mal se pagam. Frota: ${concentration?.totalCount ?? perVehicle.length}.`}
                icon={Layers}
              />
              <HeroKpi
                eyebrow="Dinheiro que ficou na mesa"
                big={fmtUSD(lostRevenue.total)}
                headline="receita perdida sem perceber"
                sub={`${fmtUSD(lostRevenue.cancelado)} em cancelamentos · ${fmtUSD(lostRevenue.janelas)} em dias ociosos.`}
                icon={CircleDollarSign}
                tone="alert"
              />
              <HeroKpi
                eyebrow="Campeão × pior"
                big={`${heroChampion ? heroChampion.roi.toFixed(0) : "—"}%  vs  ${heroWorst ? heroWorst.roi.toFixed(0) : "—"}%`}
                headline={heroChampion && heroWorst ? `${heroChampion.v.name} × ${heroWorst.v.name}` : "Sem histórico suficiente"}
                sub={heroChampion && heroWorst ? `Investido: ${fmtUSD(heroChampion.purchase)} × ${fmtUSD(heroWorst.purchase)}. Mesmo capital, mundos diferentes.` : "—"}
                icon={Award}
              />
              <HeroKpi
                eyebrow="Margem de lucro"
                big={`${fleetMargin.toFixed(1)}%`}
                headline="da receita vira lucro"
                sub={`Receita ${fmtUSD(fleetRevenue)} · Despesas ${fmtUSD(fleetExpenses)}.`}
                icon={Target}
                tone={fleetMargin >= 25 ? "good" : "alert"}
              />
            </div>
          );
        })()}

        {/* Hero KPIs */}
        {!briefingOnly && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <AiKpi label="Receita por carro/dia" sub="Quanto cada carro gera, na média, por dia que está na frota" value={fmtUSD2(revPAC)} icon={Rocket} hue="violet" />
          <AiKpi label="Diária média cobrada" sub="Valor médio efetivamente recebido por dia alugado" value={fmtUSD(fleetADR)} icon={DollarSign} hue="amber" />
          <AiKpi label="Margem de lucro" sub="Receita menos despesas, em %" value={`${fleetMargin.toFixed(1)}%`} icon={Target} hue={fleetMargin >= 25 ? "emerald" : "rose"} />
          <AiKpi label="Receita do mês até hoje" sub={`No mesmo dia do mês passado: ${fmtUSD(pacing.lmtd)} (${pacing.delta >= 0 ? "+" : ""}${pacing.delta.toFixed(1)}%)`} value={fmtUSD(pacing.mtd)} icon={pacing.delta >= 0 ? ArrowUpRight : ArrowDownRight} hue={pacing.delta >= 0 ? "emerald" : "rose"} />
        </div>
        )}



        {/* AI Briefing */}
        {!hideBriefing && (() => {
          const slugFor = (name?: string | null): string | undefined => {
            if (!name) return undefined;
            // try first 1-2 tokens
            const tokens = name.split(/\s+/);
            for (let n = Math.min(3, tokens.length); n >= 1; n--) {
              const try1 = tokens.slice(0, n).join(" ");
              const b = findBrandByName(try1);
              if (b) return b.slug;
            }
            return undefined;
          };
          const snapshot: BriefingSnapshot = {
            rodandoAgora: todayStats.rodandoAgora,
            paradosAgora: todayStats.paradosAgora,
            receitaHoje: todayStats.receitaHoje,
            receitaMtd: pacing.mtd,
            receitaLmtd: pacing.lmtd,
            deltaPct: pacing.delta,
            paybackMeses: paybackAvg,
            paretoCarros: concentration?.topForRev.length ?? 0,
            paretoTotal: concentration?.totalCount ?? 0,
            paretoFrotaPct: concentration?.topCountShare ?? 0,
            receitaPerdida: lostRevenue.total,
          };
          const highlightTop: BriefingHighlight[] = [...perVehicle]
            .filter(p => p.purchase > 0 && p.daysInFleet > 30)
            .sort((a, b) => b.roi - a.roi)
            .slice(0, 2)
            .map(p => ({
              vehicleName: p.v.name || "—",
              brandSlug: slugFor(p.v.brand || p.v.name),
              invested: p.purchase,
              days: p.daysInFleet,
              revenue: p.revenue,
              roiPct: p.roi,
              status: "destaque" as const,
              nota: "Bom desempenho. Devolveu uma boa parte do que foi investido.",
            }));
          const highlightBad: BriefingHighlight[] = [...perVehicle]
            .filter(p => p.purchase > 0 && p.daysInFleet > 60 && (p.revenue === 0 || p.roi < 5))
            .sort((a, b) => a.roi - b.roi)
            .slice(0, 2)
            .map(p => ({
              vehicleName: p.v.name || "—",
              brandSlug: slugFor(p.v.brand || p.v.name),
              invested: p.purchase,
              days: p.daysInFleet,
              revenue: p.revenue,
              roiPct: p.roi,
              status: (p.revenue === 0 ? "critico" : "atencao") as "critico" | "atencao",
              nota: p.revenue === 0 ? "Sem receita ainda. Capital parado." : "Receita baixa. Exige atenção.",
            }));
          const highlights = [...highlightTop, ...highlightBad].slice(0, 4);

          const actionList: BriefingAction[] = weeklyDecisions.slice(0, 3).map(d => {
            // try to extract a vehicle from the title (find first known brand in title)
            const slug = slugFor(d.titulo.replace(/^(Suba o preço da|Avalie trocar a|Promova a|Teste promo na)\s+/i, ""));
            // find vehicle name in title — strip leading verb phrase
            const vehMatch = d.titulo.replace(/^(Suba o preço da|Avalie trocar a|Promova a|Teste promo na)\s+/i, "").split(/\s+entre|\s+por/)[0];
            return {
              vehicleName: vehMatch && vehMatch !== d.titulo ? vehMatch : undefined,
              brandSlug: slug,
              titulo: d.titulo,
              detalhe: d.descricao,
              impacto: d.impacto,
              impactoTipo: d.impactoValor >= 0 ? "ganho" as const : "risco" as const,
              prioridade: d.prioridade,
            };
          });

          // Report data (used pelo botao "Salvar PDF" para gerar relatorio profissional)
          const heroChampionR = [...perVehicle]
            .filter(p => p.purchase > 0 && p.daysInFleet > 30 && p.revenue > 0)
            .sort((a, b) => b.roi - a.roi)[0] || null;
          const heroWorstR = [...perVehicle]
            .filter(p => p.purchase > 0 && p.daysInFleet > 60)
            .sort((a, b) => a.roi - b.roi)[0] || null;
          const report: FleetReport = {
            brandLabel: "GoDrive",
            generatedAt: new Date(),
            hero: {
              paretoShare: concentration?.topRevShare ?? 0,
              paretoCars: concentration?.topForRev.length ?? 0,
              paretoTail: concentration?.tail.length ?? 0,
              totalCars: concentration?.totalCount ?? perVehicle.length,
              lostRevenue: {
                total: lostRevenue.total,
                cancelled: lostRevenue.cancelado,
                idle: lostRevenue.janelas,
              },
              champion: heroChampionR ? {
                name: heroChampionR.v.name || "—",
                roi: heroChampionR.roi,
                invested: heroChampionR.purchase,
                revenue: heroChampionR.revenue,
              } : null,
              worst: heroWorstR ? {
                name: heroWorstR.v.name || "—",
                roi: heroWorstR.roi,
                invested: heroWorstR.purchase,
                revenue: heroWorstR.revenue,
              } : null,
              margin: fleetMargin,
            },
            kpis: {
              revPAC, adr: fleetADR, margin: fleetMargin,
              mtd: pacing.mtd, lmtd: pacing.lmtd, deltaPct: pacing.delta,
            },
            fleet: {
              revenue: fleetRevenue, expenses: fleetExpenses, invested: fleetInvested,
              roi: fleetROI, occupancy: avgOccupancy, size: perVehicle.length,
            },
            topVehicles: [...perVehicle]
              .filter(p => p.purchase > 0 && p.daysInFleet > 30 && p.revenue > 0)
              .sort((a, b) => b.roi - a.roi)
              .slice(0, 5)
              .map(p => ({ name: p.v.name || "—", invested: p.purchase, revenue: p.revenue, roi: p.roi, days: p.daysInFleet })),
            worstVehicles: [...perVehicle]
              .filter(p => p.purchase > 0 && p.daysInFleet > 60)
              .sort((a, b) => a.roi - b.roi)
              .slice(0, 5)
              .map(p => ({ name: p.v.name || "—", invested: p.purchase, revenue: p.revenue, roi: p.roi, days: p.daysInFleet })),
            actions: weeklyDecisions.slice(0, 6).map(d => ({
              titulo: d.titulo, detalhe: d.descricao, impacto: d.impacto, prioridade: d.prioridade,
            })),
          };

          return (
            <AiBriefingCard
              briefing={briefing}
              loading={briefingLoading}
              contextLabel={`${perVehicle.length} carros · ${realBookings.length} reservas`}
              snapshot={snapshot}
              highlights={highlights}
              actions={actionList}
              report={report}
            />
          );

        })()}

        {!briefingOnly && (<>
        {/* HOJE NA SUA FROTA */}
        <div className="ai-card relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-amber-300/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sun size={16} className="text-amber-300" />
                <h3 className="text-sm font-medium text-white/95">Hoje na sua frota</h3>
                <span className="text-[10px] uppercase tracking-wider text-white/45">{format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
              </div>
              <span className="text-[10.5px] text-white/50 tabular-nums">Receita rodando hoje: <span className="text-amber-200">{fmtUSD(todayStats.receitaHoje)}</span></span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              <MiniStat label="Carros rodando" value={todayStats.rodandoAgora} icon={Activity} hue="emerald" />
              <MiniStat label="Saem hoje" value={todayStats.saemHoje} icon={ArrowUpRight} hue="cyan" />
              <MiniStat label="Voltam hoje" value={todayStats.voltamHoje} icon={ArrowDownRight} hue="violet" />
              <MiniStat label="Saem amanhã" value={todayStats.saemAmanha} icon={Calendar} hue="amber" />
              <MiniStat label="Parados" value={todayStats.paradosAgora} icon={Snowflake} hue={todayStats.paradosAgora > vehicles.length / 2 ? "rose" : "amber"} />
            </div>
          </div>
        </div>

        {/* CONSELHOS DA SEMANA — Private bank palette */}
        {weeklyDecisions.length > 0 && (
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              background: "linear-gradient(180deg, #fbf7ee 0%, #f6f1e6 100%)",
              border: "1px solid rgba(13,29,46,0.10)",
              boxShadow: "0 10px 30px -18px rgba(13,29,46,0.25), 0 0 0 1px rgba(255,255,255,0.6) inset",
            }}
          >
            {/* hairline gold accent on top */}
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent, #c8a86b 30%, #9a7a3a 50%, #c8a86b 70%, transparent)" }} />
            <div className="relative p-4 sm:p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 flex-wrap mb-4 sm:mb-5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-full shrink-0" style={{ background: "#0d1d2e" }}>
                    <Lightbulb size={14} style={{ color: "#d6bf86" }} />
                  </span>
                  <span className="text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "#0d1d2e" }}>
                    Conselhos da semana
                  </span>
                </div>
                <span className="text-[10.5px] uppercase tracking-[0.16em] font-medium shrink-0" style={{ color: "rgba(13,29,46,0.55)" }}>
                  {weeklyDecisions.length} decisões com maior impacto
                </span>
              </div>

              {/* Headline */}
              <h3 className="text-[15px] sm:text-[17px] leading-[1.35] font-medium mb-5 max-w-[60ch]" style={{ color: "#0d1d2e", letterSpacing: "-0.005em" }}>
                Se você fizer só essas ações esta semana, é onde está o maior retorno.
              </h3>

              {/* Legenda — explica o que significa cada coluna */}
              <div
                className="hidden sm:grid grid-cols-[140px_1fr_220px] gap-x-5 px-5 pb-2 mb-2 text-[9.5px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "rgba(13,29,46,0.40)", borderBottom: "1px solid rgba(13,29,46,0.06)" }}
              >
                <span>Prioridade</span>
                <span>O que fazer e por quê</span>
                <span className="text-right">Impacto estimado</span>
              </div>

              {/* Decisions list — divided rows for clear separation */}
              <ul className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(13,29,46,0.08)", background: "rgba(255,255,255,0.55)" }}>
                {weeklyDecisions.map((d, i) => {
                  const isLast = i === weeklyDecisions.length - 1;
                  const pri = d.prioridade;
                  const priCfg =
                    pri === "alta"
                      ? { label: "Alta", bg: "#fdecec", border: "rgba(180,40,40,0.30)", text: "#8a1f1f", dot: "#b42828" }
                      : pri === "media"
                      ? { label: "Média", bg: "#fbf1d8", border: "rgba(154,122,58,0.40)", text: "#6b4f1d", dot: "#9a7a3a" }
                      : { label: "Baixa", bg: "#e8efe7", border: "rgba(30,90,60,0.30)", text: "#2c5a3d", dot: "#2c5a3d" };

                  // Classifica o tipo de impacto a partir do texto bruto vindo do gerador
                  const raw = d.impacto || "";
                  const isLoss = /^Diferença/i.test(raw);
                  const isGain = /^\+/.test(raw);
                  const isRecover = /^Recupere/i.test(raw);
                  const isCost = /^Cada dia/i.test(raw);

                  const impactLabel = isLoss
                    ? "Receita em risco"
                    : isGain
                    ? "Ganho potencial"
                    : isRecover
                    ? "Recuperação possível"
                    : isCost
                    ? "Custo se nada for feito"
                    : "Impacto estimado";

                  // Valor já formatado, limpo do texto auxiliar
                  const impactValue = raw
                    .replace(/^Diferença atual:\s*/i, "")
                    .replace(/^Recupere até\s*/i, "")
                    .replace(/^Cada dia parado custa\s*/i, "")
                    .replace(/\s*estimado$/i, "");

                  const impactColor = isLoss || isCost ? "#8a1f1f" : isGain || isRecover ? "#2c5a3d" : "#0d1d2e";

                  return (
                    <li
                      key={i}
                      className="grid grid-cols-1 sm:grid-cols-[140px_1fr_220px] gap-x-5 gap-y-3 items-start px-4 sm:px-5 py-4 sm:py-5"
                      style={!isLast ? { borderBottom: "1px solid rgba(13,29,46,0.07)" } : undefined}
                    >
                      {/* Coluna 1 — Prioridade + Categoria */}
                      <div className="flex sm:flex-col items-start gap-2 sm:gap-1.5">
                        <span
                          className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-[4px] rounded-md whitespace-nowrap"
                          style={{ background: priCfg.bg, border: `1px solid ${priCfg.border}`, color: priCfg.text }}
                        >
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: priCfg.dot }} />
                          {priCfg.label}
                        </span>
                        <span
                          className="text-[9.5px] font-medium uppercase tracking-[0.20em]"
                          style={{ color: "rgba(13,29,46,0.50)" }}
                        >
                          {d.categoria}
                        </span>
                      </div>

                      {/* Coluna 2 — Ação + contexto */}
                      <div className="min-w-0">
                        <h4 className="text-[15px] sm:text-[16px] font-semibold leading-snug mb-2" style={{ color: "#0d1d2e", letterSpacing: "-0.005em" }}>
                          {d.titulo}
                        </h4>
                        <div className="flex gap-2">
                          <span
                            className="shrink-0 mt-[7px] inline-block h-[3px] w-[3px] rounded-full"
                            style={{ background: "rgba(13,29,46,0.35)" }}
                          />
                          <p className="text-[13px] sm:text-[13.5px] leading-[1.6]" style={{ color: "rgba(13,29,46,0.72)" }}>
                            <span className="font-semibold" style={{ color: "rgba(13,29,46,0.85)" }}>Por quê: </span>
                            {d.descricao}
                          </p>
                        </div>
                      </div>

                      {/* Coluna 3 — Impacto em "caixinha" clara */}
                      <div
                        className="rounded-lg px-3.5 py-3 sm:py-3.5 sm:text-right"
                        style={{ background: "rgba(13,29,46,0.035)", border: "1px solid rgba(13,29,46,0.08)" }}
                      >
                        <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] mb-1" style={{ color: "rgba(13,29,46,0.55)" }}>
                          {impactLabel}
                        </div>
                        <div className="text-[17px] sm:text-[18px] tabular-nums font-semibold leading-tight" style={{ color: impactColor, letterSpacing: "-0.01em" }}>
                          {impactValue}
                        </div>
                        {isGain && (
                          <div className="text-[10.5px] mt-1" style={{ color: "rgba(13,29,46,0.50)" }}>
                            projeção em 12 meses
                          </div>
                        )}
                        {isLoss && (
                          <div className="text-[10.5px] mt-1" style={{ color: "rgba(13,29,46,0.50)" }}>
                            vs. mesmo período do mês passado
                          </div>
                        )}
                        {isRecover && (
                          <div className="text-[10.5px] mt-1" style={{ color: "rgba(13,29,46,0.50)" }}>
                            se o carro for alugado no período
                          </div>
                        )}
                        {isCost && (
                          <div className="text-[10.5px] mt-1" style={{ color: "rgba(13,29,46,0.50)" }}>
                            por cada dia sem ação
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}


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
        <div className="ai-tabs-wrap">
          <div className="ai-tabs">
            {tabs.map(t => {
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)} className={`ai-tab ${active ? "ai-tab-active" : ""}`}>
                  <t.icon size={13} /> <span>{t.label}</span>
                </button>
              );
            })}
          </div>
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
                          <div
                            className={`absolute bottom-0 left-0 right-0 rounded-t-md transition-all ${isMax ? "ai-bar-hot" : "ai-bar"}`}
                            style={{
                              height: `${Math.max(h, 4)}%`,
                              ...(m.isCurrent ? {
                                backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0 4px, transparent 4px 8px)",
                                opacity: 0.85,
                              } : {}),
                            }}
                          />
                        </div>
                        <div className="text-[11px] uppercase tracking-wider text-white/50">
                          {m.label}{m.isCurrent ? " · até hoje" : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <KpiBlock title="Receita total acumulada" value={fmtUSD(fleetRevenue)} sub={`Despesas registradas: ${fmtUSD(fleetExpenses)}`} icon={DollarSign} />
              <KpiBlock title="Receita confirmada nos próximos 30 dias" value={fmtUSD(next30)} sub={`Em 60 dias: ${fmtUSD(next60)}`} icon={Rocket} />
              <KpiBlock title="Ocupação média da frota" value={`${avgOccupancy.toFixed(1)}%`} sub={`${totalDaysBooked} dias alugados no total`} icon={Gauge} />
            </div>
          </div>
        )}

        {/* ───── Tab: DEMAND ───── */}
        {tab === "demand" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
            </div>

            <div className="ai-card">
              <CardHeader title="Buracos entre reservas. Dinheiro na mesa" sub="Períodos curtos em que o carro fica parado entre duas reservas confirmadas. Oferecer promo de última hora pode capturar essa receita." icon={Sparkles} />
              {opportunityWindows.length === 0 ? (
                <p className="ai-card-sub">Sem buracos relevantes no momento. Agenda bem encaixada.</p>
              ) : (
                <div className="ai-oppor-list">
                  {opportunityWindows.map((o, i) => (
                    <div key={i} className="ai-oppor-row">
                      <div className="ai-oppor-rank">{String(i + 1).padStart(2, "0")}</div>
                      <div className="ai-oppor-main">
                        <div className="ai-oppor-vehicle">{o.vehicle}</div>
                        <div className="ai-oppor-window">
                          {format(o.gapStart, "dd MMM", { locale: ptBR })} <span className="ai-oppor-sep">até</span> {format(o.gapEnd, "dd MMM", { locale: ptBR })}
                          <span className="ai-oppor-dot">•</span>
                          <span>{o.nights} {o.nights === 1 ? "noite parada" : "noites paradas"}</span>
                        </div>
                      </div>
                      <div className="ai-oppor-amount">
                        <div className="ai-oppor-value tabular-nums">{fmtUSD(o.estLoss)}</div>
                        <div className="ai-oppor-label">Possível recuperar</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                <ChannelBar label="Site GoDrive (Câmbio Real)" value={channelMix.stripe} total={channelMix.stripe + channelMix.turo + channelMix.other} hue="cyan" />
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

            {/* Receita Perdida & Velocidade de Pagamento */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="ai-card relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-rose-400/10 blur-3xl pointer-events-none" />
                <div className="relative">
                  <CardHeader title="Quanto você deixou na mesa" sub="Soma de cancelamentos e janelas de carro parado entre reservas" icon={CircleDollarSign} />
                  <div className="text-3xl font-light text-rose-200 tabular-nums">{fmtUSD(lostRevenue.total)}</div>
                  <div className="mt-3 space-y-1.5 text-[11.5px] text-white/65">
                    <div className="flex justify-between"><span>Cancelamentos</span><span className="tabular-nums text-white/85">{fmtUSD(lostRevenue.cancelado)}</span></div>
                    <div className="flex justify-between"><span>Carros parados entre reservas</span><span className="tabular-nums text-white/85">{fmtUSD(lostRevenue.janelas)}</span></div>
                  </div>
                  <p className="text-[11px] text-white/50 mt-3 leading-relaxed">Essa é a receita que existiria se cada cancelamento tivesse virado aluguel e cada janela curta tivesse sido preenchida com promo.</p>
                </div>
              </div>
              <div className="ai-card">
                <CardHeader title="Velocidade de pagamento da frota" sub="Em quantos meses, na média, um carro paga o que custou" icon={TimerReset} />
                {paybackAvg !== null ? (
                  <>
                    <div className="text-3xl font-light text-cyan-200 tabular-nums">{paybackAvg} <span className="text-base text-white/55">meses</span></div>
                    <p className="text-[11px] text-white/55 mt-3 leading-relaxed">Considera o preço pago pelo carro dividido pela receita média mensal projetada. Quanto menor, mais rápido o capital volta pra você.</p>
                  </>
                ) : (
                  <p className="text-white/55 text-xs">Sem dados de preço de compra suficientes ainda.</p>
                )}
              </div>
            </div>

            {/* Receita por dia da semana */}
            <div className="ai-card">
              <CardHeader title="Em que dia da semana você fatura mais" sub={`Receita histórica por dia da semana de retirada · melhor dia: ${dowRevenue.best?.label || "—"}`} icon={CalendarDays} />
              <div className="flex items-end gap-2 h-32">
                {dowRevenue.data.map((d, i) => {
                  const h = (d.rev / dowRevenue.max) * 100;
                  const isMax = d.label === dowRevenue.best?.label;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="text-[9.5px] tabular-nums text-white/60">{fmtUSD(d.rev)}</div>
                      <div className="w-full relative" style={{ height: "80px" }}>
                        <div className={`absolute bottom-0 left-0 right-0 rounded-t-md ${isMax ? "ai-bar-hot" : "ai-bar"}`} style={{ height: `${Math.max(h, 4)}%` }} />
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-white/55">{d.label}</div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-white/55 mt-3 leading-relaxed">
                A IA detectou que <span className="text-amber-200">{dowRevenue.best?.label}</span> é seu dia mais forte. Considere reservar a melhor frota e preços levemente mais altos para esse dia, e oferecer promo para o <span className="text-white/75">{dowRevenue.worst?.label || "—"}</span>.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <KpiBlock title="Total investido em carros" value={fmtUSD(fleetInvested)} sub={`Margem de lucro atual: ${fleetMargin.toFixed(1)}%`} icon={Wallet} />
              <KpiBlock title="Retorno sobre o investimento" value={`${fleetROI.toFixed(1)}%`} sub="Quanto a frota já devolveu do que foi investido" icon={Target} />
            </div>

          </div>
        )}

        {/* ───── Tab: STRATEGY ───── */}
        {tab === "strategy" && (
          <div className="space-y-3">



            {fleetProjection && fleetProjection.upliftPerDay > 0 && (
              <div className="ai-card relative overflow-hidden">
                <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-72 h-72 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <Rocket className="w-4 h-4 text-amber-300" />
                    <span className="text-[11px] uppercase tracking-[0.18em] text-amber-200/80">Projeção de frota. E se você trocasse?</span>
                  </div>
                  <h3 className="text-base md:text-lg font-light text-white leading-snug mb-1">
                    Se você tivesse{" "}
                    <span className="text-amber-200 font-medium tabular-nums">{fleetProjection.weak.length} carro{fleetProjection.weak.length > 1 ? "s" : ""}</span>
                    {" "}com o desempenho dos seus campeões no lugar dos que rendem pouco hoje,
                    em <span className="text-emerald-200 font-medium">12 meses</span> você faria{" "}
                    <span className="text-emerald-200 font-medium tabular-nums">+{fmtUSD(fleetProjection.horizons[2].uplift)}</span>{" "}
                    a mais.
                  </h3>
                  <p className="text-[12px] text-white/55 mb-4 leading-relaxed">
                    Hoje esses {fleetProjection.weak.length} carro{fleetProjection.weak.length > 1 ? "s" : ""} rendem em média{" "}
                    <span className="text-white/80 tabular-nums">{fmtUSD(fleetProjection.weakRevPerDay / fleetProjection.weak.length)}/dia</span> cada
                    {" "}({fleetProjection.weakAvgOccupancy.toFixed(0)}% de uso). Os seus campeões rendem{" "}
                    <span className="text-emerald-200 tabular-nums">{fmtUSD(fleetProjection.starAvgRevPerDay)}/dia</span>
                    {" "}({fleetProjection.starAvgOccupancy.toFixed(0)}% de uso). O mesmo capital investido passaria a render{" "}
                    <span className="text-amber-200 tabular-nums">{fleetProjection.capitalEfficiencyGain.toFixed(0)}%</span> a mais.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                    {fleetProjection.horizons.map(h => (
                      <div key={h.label} className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                        <div className="text-[10.5px] uppercase tracking-wider text-white/50 mb-1">Em {h.label}</div>
                        <div className="text-lg font-light text-emerald-200 tabular-nums">+{fmtUSD(h.uplift)}</div>
                        <div className="text-[11px] text-white/55 mt-0.5 tabular-nums">
                          Hoje {fmtUSD(h.currentRevenue)} → {fmtUSD(h.projectedRevenue)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3 mb-3">
                    <div className="text-[10.5px] uppercase tracking-wider text-white/50 mb-2">Por que essa projeção faz sentido</div>
                    <ul className="space-y-1.5 text-[12px] text-white/70 leading-relaxed">
                      <li>• Comparamos só carros com pelo menos 60 dias de histórico real. Sem chutar em cima de carro novo.</li>
                      <li>• A média de uso dos seus campeões ({fleetProjection.starAvgOccupancy.toFixed(0)}%) já foi atingida na vida real, não é meta inventada.</li>
                      {fleetProjection.avgStarPayback !== null && (
                        <li>• Carros como os campeões pagam o investimento em cerca de <span className="text-amber-200 tabular-nums">{fleetProjection.avgStarPayback.toFixed(0)} meses</span>, em média.</li>
                      )}
                      <li>• O capital parado nos carros fracos hoje é de <span className="text-white/85 tabular-nums">{fmtUSD(fleetProjection.weakCapital)}</span>. É esse dinheiro que estaria rendendo mais.</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="rounded-lg bg-rose-500/5 border border-rose-400/20 p-3">
                      <div className="text-[10.5px] uppercase tracking-wider text-rose-200/80 mb-2">Saem da frota (hipótese)</div>
                      <ul className="space-y-1">
                        {fleetProjection.weak.slice(0, 5).map(p => (
                          <li key={p.v.id} className="flex items-center justify-between gap-2 text-[12px]">
                            <span className="text-white/85 truncate">{p.v.name || "—"}</span>
                            <span className="text-rose-200 tabular-nums shrink-0">{fmtUSD(p.revPerDayOwned)}/dia · {p.occupancy.toFixed(0)}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg bg-emerald-500/5 border border-emerald-400/20 p-3">
                      <div className="text-[10.5px] uppercase tracking-wider text-emerald-200/80 mb-2">Referência de campeão</div>
                      <ul className="space-y-1">
                        {fleetProjection.stars.slice(0, 5).map(p => (
                          <li key={p.v.id} className="flex items-center justify-between gap-2 text-[12px]">
                            <span className="text-white/85 truncate">{p.v.name || "—"}</span>
                            <span className="text-emerald-200 tabular-nums shrink-0">{fmtUSD(p.revPerDayOwned)}/dia · {p.occupancy.toFixed(0)}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <p className="text-[10.5px] text-white/40 mt-3 leading-relaxed">
                    Projeção baseada no desempenho histórico dos seus próprios carros, não em previsão de mercado. Assume que um carro novo do perfil dos campeões mantém a mesma média.
                  </p>
                </div>
              </div>
            )}

            {swapSuggestions.length > 0 && (

              <div className="ai-card relative overflow-hidden">
                <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 className="w-4 h-4 text-cyan-300" />
                    <span className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">Sugestões de troca da IA</span>
                  </div>
                  <h3 className="text-base md:text-lg font-light text-white leading-snug mb-1">
                    Carros que estão dando pouco retorno e qual carro da sua frota provou render mais no lugar.
                  </h3>
                  <p className="text-[12px] text-white/55 mb-4 leading-relaxed">
                    Cada troca compara carros de valor e categoria parecidos, mostrando quanto cada um rende e o retorno anual real sobre o dinheiro investido.
                  </p>
                  <ul className="space-y-3">
                    {swapSuggestions.map((s, i) => (
                      <li key={i} className="rounded-lg bg-white/[0.03] border border-white/10 p-3.5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] uppercase tracking-wider text-rose-300/80 shrink-0">Trocar</span>
                            <span className="text-[13px] text-white/90 truncate">{s.weak.v.name}</span>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider text-emerald-300/80 shrink-0">
                            por {s.star.v.name}
                          </span>
                        </div>
                        <ol className="space-y-1 text-[12px] text-white/80 leading-relaxed list-decimal list-inside marker:text-white/40">
                          {s.lines.slice(0, 4).map((line, idx) => (
                            <li key={idx}>{line}</li>
                          ))}
                        </ol>
                        <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                          <span className="text-[10.5px] text-white/55">Critério: {s.reason}</span>
                          <span className="text-[13px] text-amber-200 font-medium tabular-nums">{s.lines[4]}</span>
                        </div>
                      </li>
                    ))}
                  </ul>

                </div>
              </div>
            )}


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

            {concentration?.topBrand && (
              <div className="grid grid-cols-1 gap-3">
                <div className="ai-card">
                  <CardHeader title="Dependência de uma marca" sub="Quanto da sua receita depende de uma única marca" icon={Layers} />
                  <div className="text-2xl font-light text-white tabular-nums">
                    {concentration.topBrand.share.toFixed(0)}% <span className="text-base text-white/50">vem de {concentration.topBrand.name}</span>
                  </div>
                  <p className="text-[12px] text-white/60 mt-2 leading-relaxed">
                    {concentration.topBrand.share > 50
                      ? "Concentração alta. Se essa marca tiver um problema (recall, manutenção, demanda fria), o impacto no caixa é grande. Vale diversificar nas próximas compras."
                      : "Distribuição saudável entre marcas. Risco diluído."}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <RecCard title="Carros para considerar vender" subtitle="Mais de 6 meses na frota com pouco uso e retorno baixo" icon={AlertTriangle} hue="rose" empty="Frota saudável. Nenhum carro nessa situação."
                items={sellCandidates.map(p => ({ name: p.v.name || "—", right: `${p.occupancy.toFixed(0)}% de uso`, sub: `Já devolveu ${p.roi.toFixed(1)}% do investido · ${p.daysInFleet} dias na frota` }))} />
              <RecCard title="Carros que aguentam preço maior" subtitle="Estão sempre alugados. Dá pra cobrar 12% a 18% a mais" icon={Flame} hue="amber" empty="Nenhum carro com demanda excedente."
                items={priceUpCandidates.map(p => ({ name: p.v.name || "—", right: `${p.occupancy.toFixed(0)}% de uso`, sub: `Hoje ${fmtUSD(p.daily)}/dia → testar ${fmtUSD(p.daily * 1.15)}/dia` }))} />
              <RecCard title="Carros parados. Testar promo" subtitle="Pouco alugados há mais de 90 dias" icon={Snowflake} hue="amber" empty="Nenhum carro nessa situação."
                items={priceDownCandidates.map(p => ({ name: p.v.name || "—", right: `${p.occupancy.toFixed(0)}% de uso`, sub: `Hoje ${fmtUSD(p.daily)}/dia → testar ${fmtUSD(p.daily * 0.85)}/dia em promo` }))} />
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
        </>)}

      </div>

      <style>{`
        /* ─── AI Studio · Private Bank Light Edition ───
           Paleta institucional inspirada em banco privado (Safra-like).
           Três pilares: warm ivory (#f4efe6) · deep navy (#0d1d2e) · institutional gold (#a07a3a).
           Tom restrito, elegante, alta legibilidade, claro mas imersivo. */
        .ai-shell {
          /* tokens */
          --zb-bg:        #efe9dc;
          --zb-bg-2:      #f6f1e6;
          --zb-surface:   #fbf7ee;
          --zb-surface-2: #f1ead9;
          --zb-ink:       #0d1d2e;
          --zb-ink-2:     rgba(13,29,46,0.78);
          --zb-ink-soft:  rgba(13,29,46,0.62);
          --zb-muted:     rgba(13,29,46,0.46);
          --zb-faint:     rgba(13,29,46,0.30);
          --zb-hairline:  rgba(13,29,46,0.10);
          --zb-hairline-strong: rgba(13,29,46,0.18);
          --zb-gold:      #9a7a3a;
          --zb-gold-2:    #b8924a;
          --zb-gold-soft: #d6bf86;
          --zb-emerald:   #2f6a4e;
          --zb-rose:      #9a3b3b;

          background:
            radial-gradient(ellipse 80% 60% at 50% -10%, rgba(154,122,58,0.10), transparent 60%),
            radial-gradient(ellipse 100% 70% at 50% 110%, rgba(13,29,46,0.05), transparent 55%),
            linear-gradient(180deg, var(--zb-bg-2) 0%, var(--zb-bg) 60%, #e9e2d2 100%);
          color: var(--zb-ink);
          isolation: isolate;
          font-feature-settings: "ss01","cv11","tnum";
        }
        .ai-bg-grid { position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(13,29,46,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(13,29,46,0.045) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: radial-gradient(ellipse at center, black 25%, transparent 78%);
          opacity: .55;
        }
        .ai-bg-glow { position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(620px circle at 10% 4%, rgba(154,122,58,0.10), transparent 65%),
            radial-gradient(720px circle at 92% 96%, rgba(13,29,46,0.06), transparent 65%);
        }
        .ai-bg-noise { position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: .018;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }

        /* Tipografia institucional */
        .ai-title {
          font-family: "Söhne","Inter",ui-sans-serif,system-ui,sans-serif;
          font-size: clamp(28px, 3vw, 38px); font-weight: 300; letter-spacing: -0.022em;
          color: var(--zb-ink); line-height: 1.05;
        }
        .ai-subtitle {
          font-size: 11.5px; letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--zb-muted); margin-top: 6px; font-weight: 500;
        }

        /* Selos / chips */
        .ai-badge { display: inline-flex; align-items: center; gap: 8px; padding: 4px 11px; border-radius: 999px;
          background: rgba(154,122,58,0.08);
          border: 1px solid rgba(154,122,58,0.32);
          font-size: 9.5px; letter-spacing: 0.26em; font-weight: 600; color: var(--zb-gold); text-transform: uppercase; }
        .ai-pulse { width: 6px; height: 6px; border-radius: 50%; background: var(--zb-gold);
          box-shadow: 0 0 10px rgba(154,122,58,0.55); animation: ai-pulse 1.8s ease-in-out infinite; }
        @keyframes ai-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }
        .ai-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px;
          background: rgba(13,29,46,0.04); border: 1px solid var(--zb-hairline);
          font-size: 10.5px; color: var(--zb-ink-soft); }

        /* Cartões — superfície ivory, hairline navy, sutil shimmer dourado */
        .ai-card {
          position: relative; padding: 20px; border-radius: 14px;
          background:
            linear-gradient(180deg, var(--zb-surface) 0%, var(--zb-surface-2) 100%);
          border: 1px solid var(--zb-hairline);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.7) inset,
            0 22px 40px -32px rgba(13,29,46,0.28),
            0 1px 2px rgba(13,29,46,0.04);
          transition: border-color .25s ease, transform .25s ease, box-shadow .25s ease;
        }
        .ai-card:hover {
          border-color: var(--zb-hairline-strong);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.7) inset,
            0 28px 48px -28px rgba(13,29,46,0.32);
        }
        .ai-card::before {
          content:""; position:absolute; inset:0; border-radius:14px; pointer-events:none;
          background: linear-gradient(135deg, rgba(154,122,58,0.20), transparent 40%);
          mask: linear-gradient(black,black) content-box, linear-gradient(black,black);
          mask-composite: exclude; -webkit-mask-composite: xor; padding: 1px;
          opacity: 0.45;
        }
        .ai-card-title { font-size: 12.5px; font-weight: 600; color: var(--zb-ink); letter-spacing: 0.01em; }
        .ai-card-sub   { font-size: 10.5px; color: var(--zb-muted); margin-top: 3px; letter-spacing: 0.02em; }

        /* Barras / heat — gold institucional + navy de apoio */
        .ai-bar         { background: linear-gradient(180deg, var(--zb-gold-2), var(--zb-gold)); }
        .ai-bar-hot     { background: linear-gradient(180deg, #c98e3a, #8a5b22); }
        .ai-bar-emerald { background: linear-gradient(90deg, #4d8a6c, var(--zb-emerald)); }
        .ai-heat        { background: linear-gradient(180deg, rgba(154,122,58,0.85), rgba(13,29,46,0.45)); }

        /* Insight / destaque — superfície champagne sutil */
        .ai-insight {
          padding: 18px 20px; border-radius: 14px;
          background:
            linear-gradient(180deg, #fbf6e8, #f3ebd4);
          border: 1px solid rgba(154,122,58,0.28);
          box-shadow: 0 0 60px -30px rgba(154,122,58,0.30) inset, 0 14px 30px -22px rgba(13,29,46,0.20);
        }
        .ai-insight-icon { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center;
          background: linear-gradient(135deg, var(--zb-gold-2), var(--zb-gold));
          color: #fbf7ee; box-shadow: 0 6px 14px -6px rgba(154,122,58,0.55);
          border: 1px solid rgba(154,122,58,0.45); }

        /* Tabs */
        .ai-tabs-wrap { position: sticky; top: 0; z-index: 20; margin: 0 -12px; padding: 6px 12px;
          background: linear-gradient(180deg, rgba(246,241,230,0.96) 72%, rgba(246,241,230,0));
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
        .ai-tabs { display: flex; gap: 6px; padding: 4px; border-radius: 12px;
          background: rgba(255,255,255,0.55);
          border: 1px solid var(--zb-hairline);
          overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
          scrollbar-width: none; }
        .ai-tabs::-webkit-scrollbar { display: none; }
        .ai-tab { display: inline-flex; align-items: center; gap: 6px; padding: 10px 14px; border-radius: 9px;
          font-size: 11.5px; letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--zb-ink-soft); white-space: nowrap;
          border: 1px solid transparent; transition: all .22s ease;
          scroll-snap-align: start; min-height: 40px; touch-action: manipulation; }
        .ai-tab:hover { color: var(--zb-ink); background: rgba(13,29,46,0.04); }
        .ai-tab-active {
          color: #fbf7ee;
          background: linear-gradient(180deg, #14283d, #0d1d2e);
          border-color: #0d1d2e;
          box-shadow: 0 8px 18px -10px rgba(13,29,46,0.45), 0 0 0 1px rgba(154,122,58,0.30) inset;
        }

        /* Alertas */
        .ai-alert { padding: 12px 14px; border-radius: 12px;
          background: rgba(13,29,46,0.03);
          border: 1px solid var(--zb-hairline); }
        .ai-alert-high {
          border-color: rgba(154,59,59,0.40);
          background: linear-gradient(135deg, #fbe9e9, #fbf7ee);
        }
        .ai-alert-med {
          border-color: rgba(154,122,58,0.40);
          background: linear-gradient(135deg, #faf0d6, #fbf7ee);
        }

        /* ─── Overrides p/ componentes legados que usavam text-white/X e bg-*-400/10 ───
           Usamos attribute selectors p/ pegar TODAS variações de opacidade (/95, /80, /70, /50, etc.) */
        .ai-shell [class*="text-white"]   { color: var(--zb-ink-2) !important; }
        .ai-shell [class*="text-white/9"],
        .ai-shell [class*="text-white/8"] { color: var(--zb-ink) !important; }
        .ai-shell [class*="text-white/7"],
        .ai-shell [class*="text-white/6"],
        .ai-shell [class*="text-white/5"] { color: var(--zb-ink-soft) !important; }
        .ai-shell [class*="text-white/4"],
        .ai-shell [class*="text-white/3"] { color: var(--zb-muted) !important; }

        /* hue text classes → navy/gold institucional (cobre /70, /80, /95 etc) */
        .ai-shell [class*="text-cyan-"]    { color: var(--zb-gold) !important; }
        .ai-shell [class*="text-violet-"]  { color: #4a3a78 !important; }
        .ai-shell [class*="text-amber-"]   { color: var(--zb-gold) !important; }
        .ai-shell [class*="text-emerald-"] { color: var(--zb-emerald) !important; }
        .ai-shell [class*="text-rose-"]    { color: var(--zb-rose) !important; }
        .ai-shell [class*="text-sky-"]     { color: #2d5a8a !important; }

        /* superfícies coloridas → champagne discreto */
        .ai-shell [class*="bg-cyan-"],
        .ai-shell [class*="bg-violet-"],
        .ai-shell [class*="bg-amber-"],
        .ai-shell [class*="bg-sky-"] {
          background-color: rgba(154,122,58,0.10) !important;
          border-color: rgba(154,122,58,0.24) !important;
        }
        .ai-shell [class*="bg-emerald-"] {
          background-color: rgba(47,106,78,0.10) !important;
          border-color: rgba(47,106,78,0.26) !important;
        }
        .ai-shell [class*="bg-rose-"] {
          background-color: rgba(154,59,59,0.08) !important;
          border-color: rgba(154,59,59,0.26) !important;
        }
        .ai-shell [class*="bg-white"] { background-color: rgba(13,29,46,0.04) !important; }

        /* KPI card glow legado → sombra navy discreta */
        .ai-shell .ai-kpi { box-shadow:
            0 1px 0 rgba(255,255,255,0.7) inset,
            0 22px 40px -28px rgba(13,29,46,0.28) !important; }
        .ai-shell .ai-kpi [style*="textShadow"] { text-shadow: none !important; }

        /* Lista de oportunidades (buracos entre reservas) */
        .ai-oppor-list { display: flex; flex-direction: column; gap: 2px; margin-top: 2px;
          border-top: 1px solid var(--zb-hairline); }
        .ai-oppor-row { display: grid; grid-template-columns: 36px 1fr auto; align-items: center;
          gap: 14px; padding: 14px 6px; border-bottom: 1px solid var(--zb-hairline);
          transition: background .18s ease; }
        .ai-oppor-row:hover { background: rgba(154,122,58,0.05); }
        .ai-oppor-rank { font-family: "Söhne","Inter",sans-serif; font-size: 11px; font-weight: 600;
          color: var(--zb-gold); letter-spacing: 0.12em; text-align: center; }
        .ai-oppor-main { min-width: 0; }
        .ai-oppor-vehicle { font-size: 13.5px; font-weight: 600; color: var(--zb-ink);
          letter-spacing: -0.005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-oppor-window { font-size: 11.5px; color: var(--zb-ink-soft); margin-top: 3px;
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .ai-oppor-sep { color: var(--zb-muted); font-size: 10.5px; }
        .ai-oppor-dot { color: var(--zb-faint); margin: 0 2px; }
        .ai-oppor-amount { text-align: right; }
        .ai-oppor-value { font-family: "Söhne","Inter",sans-serif; font-size: 17px; font-weight: 600;
          color: var(--zb-emerald); letter-spacing: -0.01em; line-height: 1.1; }
        .ai-oppor-label { font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--zb-muted); margin-top: 4px; font-weight: 600; }

        @media (max-width: 640px) {
          .ai-shell { overscroll-behavior-y: contain; }
          .ai-title { font-size: 26px; }
          .ai-subtitle { font-size: 10.5px; }
          .ai-card { padding: 15px; border-radius: 12px; }
          .ai-card::before { border-radius: 12px; }
          .ai-insight { padding: 15px; border-radius: 12px; }
          .ai-insight-icon { width: 28px; height: 28px; border-radius: 8px; }
          .ai-card-title { font-size: 12px; }
          .ai-bg-grid { background-size: 48px 48px; opacity: 0.45; }
          .ai-bg-glow { opacity: 0.85; }
        }
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

function MiniStat({ label, value, icon: Icon, hue }: { label: string; value: number; icon: typeof Brain; hue: "emerald" | "cyan" | "violet" | "amber" | "rose" }) {
  const hueMap = {
    emerald: { txt: "text-emerald-200", bg: "bg-emerald-400/10 border-emerald-300/20" },
    cyan: { txt: "text-cyan-200", bg: "bg-cyan-400/10 border-cyan-300/20" },
    violet: { txt: "text-violet-200", bg: "bg-violet-400/10 border-violet-300/20" },
    amber: { txt: "text-amber-200", bg: "bg-amber-400/10 border-amber-300/20" },
    rose: { txt: "text-rose-200", bg: "bg-rose-400/10 border-rose-300/20" },
  }[hue];
  return (
    <div className={`rounded-lg border p-2.5 ${hueMap.bg}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-white/55 leading-tight">{label}</span>
        <Icon size={12} className={`${hueMap.txt} shrink-0`} />
      </div>
      <div className={`text-xl font-light tabular-nums ${hueMap.txt}`}>{value}</div>
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
    <div className="ai-card ai-kpi" style={{ boxShadow: `0 20px 60px -30px ${hueMap.glow}` }}>
      <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
        <span className="text-[10px] sm:text-[10px] uppercase tracking-[0.16em] sm:tracking-[0.18em] text-white/55 leading-tight">{label}</span>
        <Icon size={13} className={`${hueMap.txt} shrink-0`} />
      </div>
      <div className={`text-[22px] sm:text-3xl font-light tabular-nums ${hueMap.txt}`} style={{ textShadow: `0 0 24px ${hueMap.glow}` }}>{value}</div>
      {sub && <div className="text-[10.5px] text-white/50 mt-1 leading-snug">{sub}</div>}
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
    if (p.avgOccupancy < 40) parts.push(`A frota está alugada apenas ${p.avgOccupancy.toFixed(0)}% do tempo. O foco agora deve ser atrair mais clientes antes de comprar carros novos.`);
    else if (p.avgOccupancy > 70) parts.push(`Os carros estão alugados ${p.avgOccupancy.toFixed(0)}% do tempo. É o momento certo de aumentar preço.`);
    else parts.push(`Ocupação está em ${p.avgOccupancy.toFixed(0)}%. Saudável, com espaço para ajustes pontuais.`);
  }
  if (p.revPAC) parts.push(`Cada carro está gerando em média ${fmtUSD2(p.revPAC)} por dia que está na sua frota. Use isso como referência ao avaliar a compra de um carro novo.`);
  if (p.sellCandidatesCount) parts.push(`Existem ${p.sellCandidatesCount} carro(s) com pouco uso e baixo retorno que valem ser considerados para venda.`);
  if (p.priceUpCount) parts.push(`${p.priceUpCount} carro(s) estão sempre alugados e aguentam um aumento de preço entre 12% e 18%.`);
  if (p.opportunityWindows) parts.push(`Encontrei ${p.opportunityWindows} períodos curtos de carros parados entre reservas. Uma promo de última hora pode capturar essa receita.`);
  
  if (p.topCategory) parts.push(`A categoria que mais rende hoje é ${p.topCategory}.`);
  return parts.join(" ");
}

/* HERO KPI — cartao creme+dourado com numero grande (private-bank), destaque no topo do painel */
function HeroKpi({
  eyebrow, big, headline, sub, icon: Icon, tone = "neutral",
}: {
  eyebrow: string;
  big: string;
  headline: string;
  sub: string;
  icon: typeof Brain;
  tone?: "neutral" | "good" | "alert";
}) {
  const accent =
    tone === "alert" ? "#8a2433" : tone === "good" ? "#1f6b3a" : "#0d1d2e";
  const goldBorder = "rgba(154,122,58,0.32)";
  const goldText = "#9a7a3a";
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 sm:p-5"
      style={{
        background: "linear-gradient(180deg, #fbf7ee 0%, #f3ebd4 100%)",
        border: `1px solid ${goldBorder}`,
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.7) inset, 0 22px 50px -28px rgba(13,29,46,0.35)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(500px circle at 100% 0%, rgba(154,122,58,0.10), transparent 55%)",
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-3">
          <span
            className="text-[9.5px] font-semibold uppercase leading-tight"
            style={{ letterSpacing: "0.22em", color: goldText }}
          >
            {eyebrow}
          </span>
          <div
            className="shrink-0 grid place-items-center rounded-lg"
            style={{
              width: 30,
              height: 30,
              background: "linear-gradient(135deg, #14283d, #0d1d2e)",
              color: "#d6bf86",
              border: "1px solid rgba(154,122,58,0.45)",
            }}
          >
            <Icon size={14} />
          </div>
        </div>
        <div
          className="tabular-nums font-bold leading-none"
          style={{
            color: accent,
            fontSize: "clamp(28px, 5vw, 40px)",
            fontFamily: "'Urbanist', 'Inter', system-ui, -apple-system, sans-serif",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.025em",
          }}
        >
          {big}
        </div>
        <div
          className="mt-2 text-[12.5px] sm:text-[13px] font-semibold leading-snug"
          style={{ color: "#0d1d2e" }}
        >
          {headline}
        </div>
        <div className="mt-1 text-[11px] sm:text-[11.5px] leading-snug" style={{ color: "#5d6a7c" }}>
          {sub}
        </div>
      </div>
    </div>
  );
}


