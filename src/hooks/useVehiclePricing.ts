import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PricingResult {
  nights: number;
  subtotal_rental: number;
  avg_per_day: number;
  discount_pct: number;
  base_price: number;
}

function toISO(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calls get_vehicle_pricing RPC for a single vehicle. */
export function useVehiclePricing(
  vehicleId: string | undefined,
  pickup: Date | null,
  ret: Date | null,
) {
  const [data, setData] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);

  const p = toISO(pickup);
  const r = toISO(ret);

  useEffect(() => {
    if (!vehicleId || !p || !r) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (supabase.rpc as any)("get_vehicle_pricing", {
      p_vehicle_id: vehicleId,
      p_pickup: p,
      p_return: r,
    })
      .then(({ data: rows, error }: any) => {
        if (cancelled) return;
        if (error) {
          console.warn("[useVehiclePricing] RPC error", error);
          setData(null);
        } else {
          setData(Array.isArray(rows) ? rows[0] ?? null : rows ?? null);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [vehicleId, p, r]);

  return { data, loading };
}

/** Batched: returns map vehicleId → PricingResult. */
export function useVehiclesPricingMap(
  vehicleIds: string[],
  pickup: Date | null,
  ret: Date | null,
) {
  const [map, setMap] = useState<Record<string, PricingResult>>({});
  const [loading, setLoading] = useState(false);

  const p = toISO(pickup);
  const r = toISO(ret);
  const key = vehicleIds.join(",");

  useEffect(() => {
    if (!p || !r || vehicleIds.length === 0) {
      setMap({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(
      vehicleIds.map((id) =>
        (supabase.rpc as any)("get_vehicle_pricing", {
          p_vehicle_id: id,
          p_pickup: p,
          p_return: r,
        }).then(({ data, error }: any) => {
          if (error) return [id, null] as const;
          const row = Array.isArray(data) ? data[0] ?? null : data ?? null;
          return [id, row] as const;
        }),
      ),
    )
      .then((entries) => {
        if (cancelled) return;
        const next: Record<string, PricingResult> = {};
        for (const [id, row] of entries) if (row) next[id] = row;
        setMap(next);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [key, p, r]);

  return { map, loading };
}
