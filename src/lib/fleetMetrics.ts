/**
 * Fonte única de verdade para métricas de frota.
 * Centraliza os cálculos que antes estavam duplicados em
 * AdminDashboard, AdminVehicleDetail, AdminFleetReport e AdminFleetPnL.
 */
import { differenceInDays, parseISO } from "date-fns";

export type BookingLike = {
  id: string;
  vehicle_id?: string | null;
  pickup_date: string;
  return_date: string;
  total_price?: number | null;
  addons?: unknown;
};

export type VehicleLike = {
  id: string;
  daily_price_usd?: number | null;
  purchase_price?: number | null;
  status?: string | null;
};

export type ExpenseLike = {
  vehicle_id: string;
  amount: number | null;
};

/** Chaves de addons reconhecidas em bookings.addons. */
export const ADDON_KEYS = [
  "plan_extra",
  "insurance_total",
  "child_seat_total",
  "toll_tag_total",
  "extra_driver_total",
  "return_fee",
] as const;

export type AddonKey = (typeof ADDON_KEYS)[number];

/** Soma todos os addons de uma reserva. */
export function sumBookingAddons(booking: BookingLike): number {
  const a = (booking.addons && typeof booking.addons === "object" ? booking.addons : {}) as Record<string, unknown>;
  return ADDON_KEYS.reduce((s, k) => s + (Number(a[k]) || 0), 0);
}

/** Soma cada addon separadamente em um conjunto de reservas. */
export function aggregateAddons(bookings: BookingLike[]): Record<AddonKey, number> {
  const out = Object.fromEntries(ADDON_KEYS.map((k) => [k, 0])) as Record<AddonKey, number>;
  for (const b of bookings) {
    const a = (b.addons && typeof b.addons === "object" ? b.addons : {}) as Record<string, unknown>;
    for (const k of ADDON_KEYS) out[k] += Number(a[k]) || 0;
  }
  return out;
}

/** Dias (mínimo 1) entre pickup e return. */
export function bookingNights(b: BookingLike): number {
  return Math.max(differenceInDays(parseISO(b.return_date), parseISO(b.pickup_date)), 1);
}

/** Receita total (preço cobrado) de um conjunto de reservas. */
export function sumTotalRevenue(bookings: BookingLike[]): number {
  return bookings.reduce((s, b) => s + (Number(b.total_price) || 0), 0);
}

/** Quebra receita de um veículo em locação vs. addons. */
export function vehicleRevenueBreakdown(
  vehicle: VehicleLike,
  bookings: BookingLike[],
): { rentalRevenue: number; addonRevenue: number; totalRevenue: number } {
  let rentalRevenue = 0;
  let addonRevenue = 0;
  const daily = Number(vehicle.daily_price_usd) || 0;

  for (const b of bookings) {
    // Reservas canceladas nao geram receita.
    const status = String((b as any).status || "").toLowerCase();
    if (status === "cancelled" || status === "canceled") continue;

    const addonSum = sumBookingAddons(b);
    const total = Number(b.total_price) || 0;
    const a = (b.addons && typeof b.addons === "object" ? b.addons : {}) as Record<string, unknown>;
    const isTuro = a.source === "turo";
    if (isTuro) {
      // Turo: total_price e a receita liquida real do CSV oficial.
      rentalRevenue += Math.max(total - addonSum, 0);
    } else {
      // GoDrive: usa o total cobrado da reserva. So cai pro fallback dias x diaria
      // quando nao ha total_price salvo (reservas antigas / pre-checkout).
      const base = total > 0 ? Math.max(total - addonSum, 0) : bookingNights(b) * daily;
      rentalRevenue += base;
    }
    addonRevenue += addonSum;
  }
  return { rentalRevenue, addonRevenue, totalRevenue: rentalRevenue + addonRevenue };
}

/**
 * ROI canônico da frota / de um veículo.
 * % do investimento recuperado descontando despesas.
 * Fórmula: (receita - despesas - investimento) / investimento * 100
 * Retorna null se investimento <= 0.
 */
export function calcRoiPct(
  totalRevenue: number,
  expenses: number,
  investment: number,
): number | null {
  if (!investment || investment <= 0) return null;
  return Math.round(((totalRevenue - expenses - investment) / investment) * 1000) / 10;
}

/** Lucro operacional = receita - despesas. */
export function calcOperatingProfit(totalRevenue: number, expenses: number): number {
  return totalRevenue - expenses;
}

/** Soma de despesas de um veículo. */
export function sumVehicleExpenses(vehicleId: string, expenses: ExpenseLike[]): number {
  return expenses
    .filter((e) => e.vehicle_id === vehicleId)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

/**
 * Ocupação no período: soma dos dias locados / (frota_ativa * dias_periodo) * 100.
 * Casa com a RPC get_occupancy_rate do servidor para uso no mês corrente.
 */
export function calcOccupancyPct(
  bookings: BookingLike[],
  activeVehicles: number,
  daysInPeriod: number,
): number | null {
  if (!activeVehicles || !daysInPeriod) return null;
  const totalDays = bookings.reduce((s, b) => s + bookingNights(b), 0);
  return Math.round((totalDays / (activeVehicles * daysInPeriod)) * 1000) / 10;
}

/** Ocupação individual de um veículo no período. */
export function calcVehicleOccupancyPct(
  vehicleBookings: BookingLike[],
  daysInPeriod: number,
): number {
  if (!daysInPeriod) return 0;
  const totalDays = vehicleBookings.reduce((s, b) => s + bookingNights(b), 0);
  return Math.min(100, Math.round((totalDays / daysInPeriod) * 100));
}
