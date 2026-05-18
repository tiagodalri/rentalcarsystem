import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Period = "3m" | "6m" | "12m" | "all";

type Booking = {
  id: string;
  vehicle_id: string | null;
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
  vehicle_id: string;
};

type Incident = {
  id: string;
  actual_cost: number | null;
  status: string;
  incident_date: string;
};

type ManualTx = { type: string; amount: number; transaction_date: string };

type Vehicle = { id: string; name: string; status: string };

export type Kpis = {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  ticket: number;
  occupancy: number;
  bookingsCount: number;
  cancellationRate: number;
  manual: number;
};

export type OverviewData = {
  loading: boolean;
  period: Period;
  setPeriod: (p: Period) => void;
  current: Kpis;
  previous: Kpis | null;
  showCompare: boolean;
  monthlyData: { month: string; revenue: number; expenses: number; incidents: number; profit: number }[];
  cashFlowData: { month: string; cashFlow: number; profit: number }[];
  expensesByType: { type: string; amount: number }[];
  topVehicles: { vehicleId: string; name: string; revenue: number; bookings: number }[];
  avgRentalDays: number;
  totalsRow: { active: number; cancelled: number; expensesCount: number; incidentsCount: number };
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

function monthsForPeriod(p: Period): number {
  return p === "3m" ? 3 : p === "6m" ? 6 : p === "12m" ? 12 : 9999;
}

function rangeForPeriod(p: Period): { start: Date; end: Date } {
  const end = new Date();
  if (p === "all") return { start: new Date(2000, 0, 1), end };
  const start = new Date();
  start.setMonth(start.getMonth() - monthsForPeriod(p));
  return { start, end };
}

function previousRange(start: Date, end: Date): { start: Date; end: Date } {
  const ms = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - ms), end: new Date(start.getTime()) };
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function overlapDays(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const s = aStart > bStart ? aStart : bStart;
  const e = aEnd < bEnd ? aEnd : bEnd;
  if (e < s) return 0;
  return daysBetween(s, e) + 1;
}

function computeKpis(
  bookings: Booking[],
  expenses: Expense[],
  incidents: Incident[],
  manual: ManualTx[],
  vehicles: Vehicle[],
  start: Date,
  end: Date,
): Kpis {
  const inRange = (d: string) => {
    const x = new Date(d);
    return x >= start && x <= end;
  };

  const bks = bookings.filter((b) => inRange(b.created_at));
  const activeBks = bks.filter((b) => b.status !== "cancelled");
  const revenue = activeBks.reduce((s, b) => s + (b.total_price || 0), 0);

  const exps = expenses.filter((e) => inRange(e.expense_date)).reduce((s, e) => s + e.amount, 0);
  const inc = incidents.filter((i) => inRange(i.incident_date)).reduce((s, i) => s + (i.actual_cost || 0), 0);
  const totalExp = exps + inc;
  const profit = revenue - totalExp;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const ticket = activeBks.length > 0 ? revenue / activeBks.length : 0;

  const bookingsCount = bks.filter((b) => ["confirmed", "in_progress", "completed"].includes(b.status)).length;
  const cancellationRate = bks.length > 0 ? (bks.filter((b) => b.status === "cancelled").length / bks.length) * 100 : 0;

  // Occupancy: rented days (overlap with period) / (period days × active vehicles)
  const periodDays = daysBetween(start, end) + 1;
  const activeVehicles = vehicles.filter((v) => v.status !== "sold").length;
  let rentedDays = 0;
  bookings
    .filter((b) => ["confirmed", "in_progress", "completed", "active"].includes(b.status))
    .forEach((b) => {
      const pStart = new Date(b.pickup_date + "T12:00:00");
      const pEnd = new Date(b.return_date + "T12:00:00");
      rentedDays += overlapDays(pStart, pEnd, start, end);
    });
  const occupancy = activeVehicles > 0 && periodDays > 0 ? (rentedDays / (activeVehicles * periodDays)) * 100 : 0;

  const manualNet = manual
    .filter((t) => inRange(t.transaction_date + "T12:00:00"))
    .reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);

  return {
    revenue,
    expenses: totalExp,
    profit,
    margin,
    ticket,
    occupancy,
    bookingsCount,
    cancellationRate,
    manual: manualNet,
  };
}

export function useFinanceOverview(): OverviewData {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [manual, setManual] = useState<ManualTx[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("6m");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [bRes, eRes, iRes, mRes, vRes] = await Promise.all([
        supabase.from("bookings").select("id, vehicle_id, total_price, status, pickup_date, return_date, created_at"),
        supabase.from("vehicle_expenses").select("id, amount, type, expense_date, vehicle_id"),
        supabase.from("vehicle_incidents").select("id, actual_cost, status, incident_date"),
        supabase.from("financial_transactions").select("type, amount, transaction_date").eq("source", "manual").eq("is_cancelled", false),
        supabase.from("vehicles").select("id, name, status"),
      ]);
      if (cancelled) return;
      setBookings((bRes.data as Booking[]) || []);
      setExpenses((eRes.data as Expense[]) || []);
      setIncidents((iRes.data as Incident[]) || []);
      setManual((mRes.data as ManualTx[]) || []);
      setVehicles((vRes.data as Vehicle[]) || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { current, previous, showCompare, range } = useMemo(() => {
    const range = rangeForPeriod(period);
    const cur = computeKpis(bookings, expenses, incidents, manual, vehicles, range.start, range.end);
    const compare = period !== "all";
    let prev: Kpis | null = null;
    if (compare) {
      const pr = previousRange(range.start, range.end);
      prev = computeKpis(bookings, expenses, incidents, manual, vehicles, pr.start, pr.end);
    }
    return { current: cur, previous: prev, showCompare: compare, range };
  }, [period, bookings, expenses, incidents, manual, vehicles]);

  const filteredBookings = useMemo(
    () => bookings.filter((b) => new Date(b.created_at) >= range.start && new Date(b.created_at) <= range.end),
    [bookings, range],
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((e) => new Date(e.expense_date) >= range.start && new Date(e.expense_date) <= range.end),
    [expenses, range],
  );
  const filteredIncidents = useMemo(
    () => incidents.filter((i) => new Date(i.incident_date) >= range.start && new Date(i.incident_date) <= range.end),
    [incidents, range],
  );

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; revenue: number; expenses: number; incidents: number; profit: number }> = {};
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const ensure = (d: Date) => {
      const k = key(d);
      if (!map[k]) {
        map[k] = {
          month: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          revenue: 0,
          expenses: 0,
          incidents: 0,
          profit: 0,
        };
      }
      return k;
    };
    filteredBookings.filter((b) => b.status !== "cancelled").forEach((b) => {
      const k = ensure(new Date(b.created_at));
      map[k].revenue += b.total_price || 0;
    });
    filteredExpenses.forEach((e) => {
      const k = ensure(new Date(e.expense_date));
      map[k].expenses += e.amount;
    });
    filteredIncidents.forEach((i) => {
      const k = ensure(new Date(i.incident_date));
      map[k].incidents += i.actual_cost || 0;
    });
    Object.values(map).forEach((m) => {
      m.profit = m.revenue - m.expenses - m.incidents;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredBookings, filteredExpenses, filteredIncidents]);

  const cashFlowData = useMemo(() => {
    let cum = 0;
    return monthlyData.map((m) => {
      cum += m.profit;
      return { month: m.month, profit: m.profit, cashFlow: cum };
    });
  }, [monthlyData]);

  const expensesByType = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      map[e.type] = (map[e.type] || 0) + e.amount;
    });
    return Object.entries(map)
      .map(([t, a]) => ({ type: expenseTypeLabels[t] || t, amount: a }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  const topVehicles = useMemo(() => {
    const map: Record<string, { revenue: number; bookings: number }> = {};
    filteredBookings
      .filter((b) => b.status !== "cancelled" && b.vehicle_id)
      .forEach((b) => {
        const id = b.vehicle_id as string;
        if (!map[id]) map[id] = { revenue: 0, bookings: 0 };
        map[id].revenue += b.total_price || 0;
        map[id].bookings += 1;
      });
    const nameOf = (id: string) => vehicles.find((v) => v.id === id)?.name || "Veículo removido";
    return Object.entries(map)
      .map(([vehicleId, v]) => ({ vehicleId, name: nameOf(vehicleId), revenue: v.revenue, bookings: v.bookings }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredBookings, vehicles]);

  const avgRentalDays = useMemo(() => {
    const completed = filteredBookings.filter((b) => b.status === "completed");
    if (completed.length === 0) return 0;
    const total = completed.reduce((s, b) => {
      const d = daysBetween(new Date(b.pickup_date), new Date(b.return_date)) + 1;
      return s + d;
    }, 0);
    return total / completed.length;
  }, [filteredBookings]);

  const totalsRow = useMemo(
    () => ({
      active: filteredBookings.filter((b) => b.status !== "cancelled").length,
      cancelled: filteredBookings.filter((b) => b.status === "cancelled").length,
      expensesCount: filteredExpenses.length,
      incidentsCount: filteredIncidents.length,
    }),
    [filteredBookings, filteredExpenses, filteredIncidents],
  );

  return {
    loading,
    period,
    setPeriod,
    current,
    previous,
    showCompare,
    monthlyData,
    cashFlowData,
    expensesByType,
    topVehicles,
    avgRentalDays,
    totalsRow,
  };
}
