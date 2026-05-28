import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DBVehicle {
  id: string;
  name: string;
  category: string;
  daily_price_usd: number;
  passengers: number;
  bags: number;
  transmission: string;
  fuel: string;
  year: number | null;
  status: string;
  features: string[] | null;
  image_url: string | null;
  published?: boolean;
}

let cachedVehicles: DBVehicle[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

export function useVehiclesDB() {
  const [vehicles, setVehicles] = useState<DBVehicle[]>(cachedVehicles || []);
  const [loading, setLoading] = useState(!cachedVehicles);

  useEffect(() => {
    const now = Date.now();
    if (cachedVehicles && now - cacheTimestamp < CACHE_TTL) {
      setVehicles(cachedVehicles);
      setLoading(false);
      return;
    }

    supabase
      .from("vehicles")
      .select("id, name, category, daily_price_usd, passengers, bags, transmission, fuel, year, status, features, image_url, published, photos")
      .eq("published", true)
      .is("deleted_at", null)
      .order("daily_price_usd", { ascending: false })
      .then(({ data }) => {
        const list = (data || []) as DBVehicle[];
        cachedVehicles = list;
        cacheTimestamp = Date.now();
        setVehicles(list);
        setLoading(false);
      });
  }, []);

  return { vehicles, loading };
}

/** Get price map from DB vehicles (name → daily_price_usd) */
export function buildPriceMap(vehicles: DBVehicle[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const v of vehicles) {
    map[v.name] = v.daily_price_usd;
  }
  return map;
}

/** Get trim/features map from DB vehicles */
export function buildTrimMap(vehicles: DBVehicle[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const v of vehicles) {
    map[v.name] = v.features?.join(" / ") || "";
  }
  return map;
}

/** Map DB category to categoryKey used in frontend */
export function categoryToKey(category: string): string {
  const map: Record<string, string> = {
    "Super Esportivo": "superSport",
    "Esportivo": "sport",
    "SUV Premium": "suvPremium",
    "SUV Full Size": "suvFullSize",
    "SUV": "suv",
    "SUV Compacto": "suvCompact",
    "Minivan": "minivan",
  };
  return map[category] || "suv";
}
