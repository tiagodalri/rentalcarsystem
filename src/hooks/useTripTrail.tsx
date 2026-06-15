import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TrailPoint = {
  lat: number;
  lng: number;
  speed: number | null;
  reported_at: string;
};

const POLL_MS = 6000;

/**
 * Returns the most recent trail (last `hours` hours) for a vehicle.
 * Polls `vehicle_telemetry_history` AND the live `vehicle_telemetry` row
 * every few seconds so the breadcrumb keeps growing in real time as the
 * car moves — same behavior as the Bouncie portal.
 */
export function useTripTrail(vehicleId: string | null, hours = 24) {
  const [points, setPoints] = useState<TrailPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const lastTsRef = useRef<string | null>(null);

  useEffect(() => {
    lastTsRef.current = null;
    setPoints([]);
    if (!vehicleId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const mergeTip = async (base: TrailPoint[]): Promise<TrailPoint[]> => {
      // Append current live telemetry as the "tip" if it's newer than the
      // last history row, so the line always reaches the moving car icon.
      const { data: live } = await supabase
        .from("vehicle_telemetry")
        .select("lat, lng, speed, reported_at")
        .eq("vehicle_id", vehicleId)
        .maybeSingle();
      if (!live || live.lat == null || live.lng == null || !live.reported_at) return base;
      const last = base[base.length - 1];
      if (!last || new Date(live.reported_at).getTime() > new Date(last.reported_at).getTime()) {
        return [
          ...base,
          {
            lat: Number(live.lat),
            lng: Number(live.lng),
            speed: live.speed != null ? Number(live.speed) : null,
            reported_at: String(live.reported_at),
          },
        ];
      }
      return base;
    };

    const initial = async () => {
      setLoading(true);
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("vehicle_telemetry_history")
        .select("lat, lng, speed, reported_at")
        .eq("vehicle_id", vehicleId)
        .gte("reported_at", since)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .order("reported_at", { ascending: true })
        .limit(2000);
      if (cancelled) return;
      if (error) {
        console.error("[useTripTrail]", error.message);
        setPoints([]);
        setLoading(false);
        return;
      }
      const base = (data ?? []) as TrailPoint[];
      const merged = await mergeTip(base);
      if (cancelled) return;
      lastTsRef.current = merged.length ? merged[merged.length - 1].reported_at : null;
      setPoints(merged);
      setLoading(false);
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const lastTs = lastTsRef.current;
        let query = supabase
          .from("vehicle_telemetry_history")
          .select("lat, lng, speed, reported_at")
          .eq("vehicle_id", vehicleId)
          .not("lat", "is", null)
          .not("lng", "is", null)
          .order("reported_at", { ascending: true })
          .limit(500);
        if (lastTs) query = query.gt("reported_at", lastTs);
        const { data, error } = await query;
        if (cancelled) return;

        let snapshot: TrailPoint[] = [];
        setPoints((prev) => {
          if (!error && data && data.length > 0) {
            snapshot = [...prev, ...(data as TrailPoint[])];
            lastTsRef.current = snapshot[snapshot.length - 1].reported_at;
            return snapshot;
          }
          snapshot = prev;
          return prev;
        });

        // Extend with live tip (covers cases where history hasn't flushed yet)
        const merged = await mergeTip(snapshot);
        if (cancelled) return;
        if (merged.length !== snapshot.length) {
          lastTsRef.current = merged[merged.length - 1].reported_at;
          setPoints(merged);
        }
      } catch (e) {
        console.warn("[useTripTrail] poll error", (e as Error).message);
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
      }
    };

    initial().then(() => {
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
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
