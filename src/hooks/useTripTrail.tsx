import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TrailPoint = {
  lat: number;
  lng: number;
  speed: number | null;
  reported_at: string;
};

const POLL_MS = 6000;
// Snap a sliding window of the most-recent points to the actual road
// network. Older points stay as-is (already snapped on the last pass) so we
// don't burn API quota re-snapping the same kilometers every poll.
const SNAP_WINDOW = 100;
const SNAP_DEBOUNCE_MS = 800;

/**
 * Returns the most recent trail (last `hours` hours) for a vehicle.
 *
 * Pipeline:
 *  1. Initial fetch of `vehicle_telemetry_history` (last N hours).
 *  2. Realtime subscription on `vehicle_telemetry` (live tip) + periodic
 *     poll on `vehicle_telemetry_history` as a safety net.
 *  3. Sliding-window snap-to-roads on the tail — produces the smooth,
 *     road-following polyline Bouncie shows (no more "cutting through
 *     buildings" between sparse GPS fixes).
 */
export function useTripTrail(vehicleId: string | null, hours = 24) {
  // What we render — already snapped to roads for the tail.
  const [points, setPoints] = useState<TrailPoint[]>([]);
  const [loading, setLoading] = useState(false);

  // Raw (un-snapped) fixes, kept internally so we can re-snap the tail
  // whenever a new fix arrives.
  const rawRef = useRef<TrailPoint[]>([]);
  const lastTsRef = useRef<string | null>(null);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapInFlightRef = useRef(false);
  const snapPendingRef = useRef(false);

  useEffect(() => {
    lastTsRef.current = null;
    rawRef.current = [];
    setPoints([]);
    if (!vehicleId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // ---- Road snapping ----------------------------------------------------
    const scheduleSnap = () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(() => void runSnap(), SNAP_DEBOUNCE_MS);
    };

    const runSnap = async () => {
      if (cancelled) return;
      if (snapInFlightRef.current) { snapPendingRef.current = true; return; }
      const raw = rawRef.current;
      if (raw.length < 2) {
        setPoints(raw);
        return;
      }
      snapInFlightRef.current = true;
      try {
        const tailStart = Math.max(0, raw.length - SNAP_WINDOW);
        const head = raw.slice(0, tailStart);
        const tail = raw.slice(tailStart);
        const { data, error } = await supabase.functions.invoke("snap-to-roads", {
          body: { path: tail.map((p) => ({ lat: p.lat, lng: p.lng })), interpolate: true },
        });
        if (cancelled) return;
        if (error || !data?.snapped?.length) {
          // Fall back to raw — better than nothing.
          setPoints([...head, ...tail]);
          return;
        }
        const snapped = (data.snapped as Array<{ lat: number; lng: number; originalIndex: number | null }>)
          .map((s) => {
            // Carry speed/timestamp from the nearest original raw point so
            // speed-band coloring still works on the snapped polyline.
            const oi = s.originalIndex;
            const src = oi != null && tail[oi] ? tail[oi] : tail[tail.length - 1];
            return {
              lat: s.lat,
              lng: s.lng,
              speed: src?.speed ?? null,
              reported_at: src?.reported_at ?? new Date().toISOString(),
            } as TrailPoint;
          });
        setPoints([...head, ...snapped]);
      } catch (e) {
        console.warn("[useTripTrail] snap failed", (e as Error).message);
        setPoints([...rawRef.current]);
      } finally {
        snapInFlightRef.current = false;
        if (snapPendingRef.current) {
          snapPendingRef.current = false;
          scheduleSnap();
        }
      }
    };

    // ---- Live tip (current telemetry row) --------------------------------
    const mergeTip = async (base: TrailPoint[]): Promise<TrailPoint[]> => {
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

    const applyTipPoint = (p: TrailPoint) => {
      const arr = rawRef.current;
      const last = arr[arr.length - 1];
      if (last && new Date(p.reported_at).getTime() <= new Date(last.reported_at).getTime()) return;
      rawRef.current = [...arr, p];
      lastTsRef.current = p.reported_at;
      scheduleSnap();
    };

    // ---- Initial fetch ---------------------------------------------------
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
        setLoading(false);
        return;
      }
      const base = (data ?? []) as TrailPoint[];
      const merged = await mergeTip(base);
      if (cancelled) return;
      rawRef.current = merged;
      lastTsRef.current = merged.length ? merged[merged.length - 1].reported_at : null;
      setPoints(merged); // show raw immediately, snapped version replaces it
      setLoading(false);
      scheduleSnap();
    };

    // ---- Polling fallback (history catch-up) -----------------------------
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
        let changed = false;
        if (!error && data && data.length > 0) {
          rawRef.current = [...rawRef.current, ...(data as TrailPoint[])];
          lastTsRef.current = rawRef.current[rawRef.current.length - 1].reported_at;
          changed = true;
        }
        const merged = await mergeTip(rawRef.current);
        if (cancelled) return;
        if (merged.length !== rawRef.current.length) {
          rawRef.current = merged;
          lastTsRef.current = merged[merged.length - 1].reported_at;
          changed = true;
        }
        if (changed) scheduleSnap();
      } catch (e) {
        console.warn("[useTripTrail] poll error", (e as Error).message);
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
      }
    };

    // ---- Realtime subscription on the live tip ---------------------------
    const channel = supabase
      .channel(`trip-trail-${vehicleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicle_telemetry", filter: `vehicle_id=eq.${vehicleId}` },
        (payload) => {
          const row = payload.new as Partial<TrailPoint> & { reported_at?: string } | null;
          if (!row || row.lat == null || row.lng == null || !row.reported_at) return;
          applyTipPoint({
            lat: Number(row.lat),
            lng: Number(row.lng),
            speed: row.speed != null ? Number(row.speed) : null,
            reported_at: String(row.reported_at),
          });
        },
      )
      .subscribe();

    initial().then(() => {
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      supabase.removeChannel(channel);
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
