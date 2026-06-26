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
  brand?: string | null;
  model?: string | null;
  model_year?: number | null;
  color?: string | null;
  
  photos?: any;
  doors?: number | null;
  default_deposit_amount?: number;
  default_franchise_amount?: number;
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
      .select("id, name, category, daily_price_usd, passengers, bags, transmission, fuel, year, status, features, image_url, published, photos, brand, model, model_year, color, doors, default_deposit_amount, default_franchise_amount")
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
