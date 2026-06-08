import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TrailPoint = {
  lat: number;
  lng: number;
  speed: number | null;
  reported_at: string;
};

/**
 * Returns the most recent trail (last `hours` hours) for a vehicle from
 * vehicle_telemetry_history, ordered oldest -> newest.
 */
export function useTripTrail(vehicleId: string | null, hours = 24) {
  const [points, setPoints] = useState<TrailPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vehicleId) {
      setPoints([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    supabase
      .from("vehicle_telemetry_history")
      .select("lat, lng, speed, reported_at")
      .eq("vehicle_id", vehicleId)
      .gte("reported_at", since)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .order("reported_at", { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[useTripTrail]", error.message);
          setPoints([]);
        } else {
          setPoints((data ?? []) as TrailPoint[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vehicleId, hours]);

  return { points, loading };
}

/** Color a speed in mph using the Bouncie "speed bands" palette. */
export function speedBandColor(speedMph: number | null): string {
  const s = speedMph ?? 0;
  if (s < 35) return "#f59e0b";   // 0-35 amber
  if (s < 45) return "#22c55e";   // 35-45 green
  if (s < 50) return "#3b82f6";   // 45-50 blue
  if (s < 65) return "#ec4899";   // 50-65 pink
  return "#ef4444";               // 65+ red
}
