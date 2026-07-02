import { parseDateOnly } from "@/lib/dateOnly";
import { addDays } from "date-fns";

export type PvVehicle = {
  id: string;
  name: string | null;
  status?: string | null;
  color: string | null;
  daily_price_usd: number | null;
  purchase_price: number | null;
  acquired_date: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
};
export type PvBooking = {
  id: string;
  status: string;
  pickup_date: string;
  return_date: string;
  total_price: number | null;
  vehicle_id: string | null;
  customer_name?: string | null;
  customer_id?: string | null;
  stripe_session_id?: string | null;
  turo_reservation_code?: string | null;
};
export type PvExpense = { vehicle_id: string; amount: number; expense_date: string; type?: string | null };

/**
 * Centralized per-vehicle analytics used by AI Studio (Painel + Simulador).
 * Mantido idêntico à versão original do AiPainel pra garantir consistência.
 */
export function computePerVehicle(
  vehicles: PvVehicle[],
  realBookings: PvBooking[],
  expenses: PvExpense[],
  today: Date,
) {
  const dayMs = 86400000;
  const todayMs = today.getTime();

  return vehicles.map(v => {
    const vb = realBookings.filter(b => b.vehicle_id === v.id);
    const revenue = vb.reduce((s, b) => s + (Number(b.total_price) || 0), 0);
    const exp = expenses.filter(e => e.vehicle_id === v.id)
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    const acquiredDate = v.acquired_date
      ? new Date(v.acquired_date)
      : (vb.length
          ? new Date(Math.min(...vb.map(b => parseDateOnly(b.pickup_date).getTime())))
          : null);
    const acquiredMs = acquiredDate ? acquiredDate.getTime() : null;

    const daysInFleet = acquiredMs
      ? Math.max(Math.round((todayMs - acquiredMs) / dayMs), 1)
      : 90;

    let daysBookedTotal = 0;
    let daysBookedHistorical = 0;
    vb.forEach(b => {
      const pk = parseDateOnly(b.pickup_date).getTime();
      const rt = parseDateOnly(b.return_date).getTime();
      const rawDays = Math.max(Math.round((rt - pk) / dayMs), 1);
      daysBookedTotal += rawDays;
      const lo = acquiredMs ? Math.max(pk, acquiredMs) : pk;
      const hi = Math.min(rt, todayMs);
      if (hi > lo) daysBookedHistorical += Math.round((hi - lo) / dayMs);
    });

    const rawOccupancy = (daysBookedHistorical / daysInFleet) * 100;
    const occupancy = Math.max(0, Math.min(100, rawOccupancy));
    const purchase = Number(v.purchase_price) || 0;
    const profit = revenue - exp;
    const roi = purchase > 0 ? (profit / purchase) * 100 : 0;
    const revPerDayOwned = revenue / daysInFleet;
    const daily = Number(v.daily_price_usd) || 0;
    const adr = daysBookedTotal > 0 ? revenue / daysBookedTotal : 0;
    const adrGap = daily > 0 ? ((adr - daily) / daily) * 100 : 0;
    const paybackMonths = daily > 0 && purchase > 0
      ? Math.ceil(purchase / (daily * 20)) : null;
    const dailyRevRate = daysInFleet > 0 ? revenue / daysInFleet : 0;
    const breakEvenDays = purchase > 0 && dailyRevRate > 0
      ? Math.ceil((purchase - (revenue - exp)) / dailyRevRate) : null;
    const breakEvenDate = breakEvenDays !== null && breakEvenDays > 0
      ? addDays(today, breakEvenDays) : null;
    const customerCount = new Set(vb.map(b => b.customer_id || b.customer_name).filter(Boolean)).size;

    return {
      v, revenue, exp, profit,
      daysBooked: daysBookedHistorical,
      daysBookedTotal,
      daysInFleet, occupancy, roi,
      revPerDayOwned, paybackMonths, purchase, daily, adr, adrGap, customerCount,
      breakEvenDate, breakEvenDays,
      bookingsCount: vb.length,
      hasAcquiredDate: !!v.acquired_date,
      isNewToFleet: daysInFleet < 30,
    };
  });
}
