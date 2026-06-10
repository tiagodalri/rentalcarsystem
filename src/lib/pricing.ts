import { supabase } from "@/integrations/supabase/client";

export type PriceSeason = {
  id: string;
  vehicle_id: string;
  name: string;
  start_date: string;
  end_date: string;
  price_usd: number;
  priority: number;
};

export type PriceOverride = {
  id: string;
  vehicle_id: string;
  date: string;
  price_usd: number;
  note: string | null;
};

export type PricingRules = {
  vehicle_id: string;
  weekend_multiplier: number;
  weekly_discount_pct: number;
  monthly_discount_pct: number;
  min_nights: number;
  weekend_days: number[];
};

export type PricingResult = {
  nights: number;
  subtotal_rental: number;
  avg_per_day: number;
  discount_pct: number;
  base_price: number;
};

/** Server-side authoritative pricing (used by booking engine + admin preview). */
export async function getVehiclePricing(
  vehicleId: string,
  pickup: string,
  ret: string,
): Promise<PricingResult | null> {
  try {
    const { data, error } = await (supabase as any).rpc("get_vehicle_pricing", {
      p_vehicle_id: vehicleId,
      p_pickup: pickup,
      p_return: ret,
    });
    if (error || !data || !data[0]) return null;
    const r = data[0];
    return {
      nights: Number(r.nights),
      subtotal_rental: Number(r.subtotal_rental),
      avg_per_day: Number(r.avg_per_day),
      discount_pct: Number(r.discount_pct),
      base_price: Number(r.base_price),
    };
  } catch {
    return null;
  }
}

/** Client-side helper: resolves the price for a single date.
 *  Mirrors the RPC logic so the admin calendar can show colored cells. */
export function resolvedPriceForDate(
  date: Date,
  base: number,
  seasons: PriceSeason[],
  overrides: PriceOverride[],
  rules: PricingRules | null,
): { price: number; source: "override" | "season" | "base"; weekend: boolean } {
  const iso = date.toISOString().slice(0, 10);
  const dow = date.getDay(); // 0=Sun..6=Sat
  const weekendDays = rules?.weekend_days ?? [5, 6];
  const weekendMul = rules?.weekend_multiplier ?? 1;
  const isWeekend = weekendDays.includes(dow);

  const ov = overrides.find((o) => o.date === iso);
  if (ov) {
    const p = ov.price_usd * (isWeekend ? weekendMul : 1);
    return { price: p, source: "override", weekend: isWeekend };
  }
  const seasonCandidates = seasons.filter((s) => iso >= s.start_date && iso <= s.end_date);
  if (seasonCandidates.length) {
    seasonCandidates.sort((a, b) => b.priority - a.priority || a.start_date.localeCompare(b.start_date));
    const s = seasonCandidates[0];
    const p = s.price_usd * (isWeekend ? weekendMul : 1);
    return { price: p, source: "season", weekend: isWeekend };
  }
  return { price: base * (isWeekend ? weekendMul : 1), source: "base", weekend: isWeekend };
}
