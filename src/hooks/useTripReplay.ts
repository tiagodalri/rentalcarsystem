import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";

export type ReplayPoint = {
  lat: number;
  lng: number;
  /** ms from trip start */
  t: number;
  /** mph, interpolated/derived */
  speed: number;
  /** degrees, 0=N */
  heading: number;
  /** meters from start, cumulative */
  dist: number;
};

export type ReplayEvent = {
  kind: "start" | "end" | "hard_brake" | "hard_accel" | "stop" | "peak_speed";
  t: number;          // ms from trip start
  lat: number;
  lng: number;
  speed?: number;     // mph at event
  durationMs?: number; // for stops
  label: string;      // human label, pt-BR
};

export type ReplayData = {
  tripId: string;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  totalDistanceMi: number;
  avgSpeedMph: number;
  maxSpeedMph: number;
  hardBrakes: number;
  hardAccels: number;
  totalIdleSeconds: number;
  startAddress: string | null;
  endAddress: string | null;
  points: ReplayPoint[];
  events: ReplayEvent[];
  /** bounds for fit: {sw, ne} */
  bounds: { south: number; west: number; north: number; east: number };
};

const R_EARTH_M = 6371000;

function toRad(d: number) { return (d * Math.PI) / 180; }
function toDeg(r: number) { return (r * 180) / Math.PI; }

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.sqrt(h));
}

function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function useTripReplay(tripId: string | null) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [{ data: trip, error: dbErr }, google] = await Promise.all([
          supabase.from("vehicle_trips").select("*").eq("id", tripId).maybeSingle(),
          loadGoogleMaps(),
        ]);
        if (cancelled) return;
        if (dbErr) throw dbErr;
        if (!trip) throw new Error("Viagem não encontrada");

        const raw = (trip.raw ?? {}) as any;
        const encoded: string | null =
          (typeof raw.gps === "string" ? raw.gps : null) ??
          (typeof trip.gps === "string" ? (trip.gps as any) : null);
        if (!encoded) throw new Error("Esta viagem não tem rota gravada (polyline ausente).");

        const decoded: any[] = google.maps.geometry.encoding.decodePath(encoded);
        let raw_points = decoded.map((p) => ({ lat: p.lat(), lng: p.lng() }));
        if (raw_points.length < 2) throw new Error("Rota muito curta para reproduzir.");

        // Downsample very long routes while preserving start/end
        const MAX_PTS = 600;
        if (raw_points.length > MAX_PTS) {
          const step = raw_points.length / MAX_PTS;
          const out: typeof raw_points = [];
          for (let i = 0; i < MAX_PTS; i++) out.push(raw_points[Math.floor(i * step)]);
          if (out[out.length - 1] !== raw_points[raw_points.length - 1]) out.push(raw_points[raw_points.length - 1]);
          raw_points = out;
        }

        const startedAt = trip.started_at ? new Date(trip.started_at) : new Date();
        const endedAt = trip.ended_at ? new Date(trip.ended_at) : new Date(startedAt.getTime() + 60000);
        const durationMs = Math.max(60000, endedAt.getTime() - startedAt.getTime());

        const n = raw_points.length;
        const dt = durationMs / (n - 1); // ms per vertex (uniform-time assumption)

        // Cumulative distance + segment speeds
        const segDist: number[] = new Array(n - 1);
        const segSpeedMph: number[] = new Array(n - 1);
        const segBearing: number[] = new Array(n - 1);
        const cumDist: number[] = new Array(n);
        cumDist[0] = 0;
        for (let i = 0; i < n - 1; i++) {
          const d = haversine(raw_points[i], raw_points[i + 1]);
          segDist[i] = d;
          cumDist[i + 1] = cumDist[i] + d;
          const mps = d / (dt / 1000);
          segSpeedMph[i] = mps * 2.23694;
          segBearing[i] = bearing(raw_points[i], raw_points[i + 1]);
        }

        // Point speed = average of adjacent segments; smooth lightly
        const ptSpeedRaw: number[] = new Array(n);
        ptSpeedRaw[0] = segSpeedMph[0] ?? 0;
        ptSpeedRaw[n - 1] = segSpeedMph[n - 2] ?? 0;
        for (let i = 1; i < n - 1; i++) ptSpeedRaw[i] = (segSpeedMph[i - 1] + segSpeedMph[i]) / 2;
        // 3-point moving avg
        const ptSpeed: number[] = ptSpeedRaw.map((_, i) => {
          const a = ptSpeedRaw[Math.max(0, i - 1)];
          const b = ptSpeedRaw[i];
          const c = ptSpeedRaw[Math.min(n - 1, i + 1)];
          return (a + b + c) / 3;
        });

        const ptBearing: number[] = new Array(n);
        ptBearing[0] = segBearing[0] ?? 0;
        for (let i = 1; i < n; i++) ptBearing[i] = segBearing[Math.min(i - 1, n - 2)] ?? 0;

        const points: ReplayPoint[] = raw_points.map((p, i) => ({
          lat: p.lat,
          lng: p.lng,
          t: Math.round(i * dt),
          speed: ptSpeed[i],
          heading: ptBearing[i],
          dist: cumDist[i],
        }));

        // Events
        const events: ReplayEvent[] = [];
        events.push({
          kind: "start",
          t: 0,
          lat: points[0].lat,
          lng: points[0].lng,
          speed: points[0].speed,
          label: `Partida — ${startedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        });
        events.push({
          kind: "end",
          t: points[n - 1].t,
          lat: points[n - 1].lat,
          lng: points[n - 1].lng,
          speed: points[n - 1].speed,
          label: `Chegada — ${endedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        });

        // Peak speed
        let peakIdx = 0;
        for (let i = 1; i < n; i++) if (ptSpeed[i] > ptSpeed[peakIdx]) peakIdx = i;
        if (ptSpeed[peakIdx] > 10) {
          events.push({
            kind: "peak_speed",
            t: points[peakIdx].t,
            lat: points[peakIdx].lat,
            lng: points[peakIdx].lng,
            speed: ptSpeed[peakIdx],
            label: `Pico de velocidade — ${Math.round(ptSpeed[peakIdx])} mph`,
          });
        }

        // Hard braking / acceleration detection on speed deltas
        // window ≈ 4s
        const windowSamples = Math.max(1, Math.round(4000 / dt));
        for (let i = windowSamples; i < n; i++) {
          const ds = ptSpeed[i] - ptSpeed[i - windowSamples];
          if (ds <= -12) {
            // dedupe close events
            const last = [...events].reverse().find((e) => e.kind === "hard_brake");
            if (!last || points[i].t - last.t > 5000) {
              events.push({
                kind: "hard_brake",
                t: points[i].t,
                lat: points[i].lat,
                lng: points[i].lng,
                speed: ptSpeed[i],
                label: `Freada brusca — ${Math.round(ptSpeed[i - windowSamples])} → ${Math.round(ptSpeed[i])} mph`,
              });
            }
          } else if (ds >= 10) {
            const last = [...events].reverse().find((e) => e.kind === "hard_accel");
            if (!last || points[i].t - last.t > 5000) {
              events.push({
                kind: "hard_accel",
                t: points[i].t,
                lat: points[i].lat,
                lng: points[i].lng,
                speed: ptSpeed[i],
                label: `Aceleração brusca — ${Math.round(ptSpeed[i - windowSamples])} → ${Math.round(ptSpeed[i])} mph`,
              });
            }
          }
        }

        // Stops: runs of consecutive segments with very low ground speed (< 2 mph) for > 90s
        let runStart = -1;
        for (let i = 0; i < n - 1; i++) {
          const slow = segSpeedMph[i] < 2;
          if (slow && runStart < 0) runStart = i;
          if ((!slow || i === n - 2) && runStart >= 0) {
            const runEnd = slow ? i : i - 1;
            const durMs = (runEnd - runStart + 1) * dt;
            if (durMs > 90_000) {
              const midIdx = Math.floor((runStart + runEnd) / 2);
              events.push({
                kind: "stop",
                t: points[midIdx].t,
                lat: points[midIdx].lat,
                lng: points[midIdx].lng,
                durationMs: durMs,
                label: `Parado por ${Math.round(durMs / 60000)} min`,
              });
            }
            runStart = -1;
          }
        }

        events.sort((a, b) => a.t - b.t);

        // Bounds
        let south = points[0].lat, north = points[0].lat, west = points[0].lng, east = points[0].lng;
        for (const p of points) {
          if (p.lat < south) south = p.lat;
          if (p.lat > north) north = p.lat;
          if (p.lng < west) west = p.lng;
          if (p.lng > east) east = p.lng;
        }

        const out: ReplayData = {
          tripId,
          startedAt,
          endedAt,
          durationMs,
          totalDistanceMi: Number(trip.distance_mi ?? 0),
          avgSpeedMph: Number(raw.averageSpeed ?? trip.avg_speed_mph ?? 0),
          maxSpeedMph: Number(raw.maxSpeed ?? trip.max_speed_mph ?? ptSpeed[peakIdx] ?? 0),
          hardBrakes: Number(raw.hardBrakingCount ?? trip.hard_braking ?? 0),
          hardAccels: Number(raw.hardAccelerationCount ?? trip.hard_accel ?? 0),
          totalIdleSeconds: Number(raw.totalIdleDuration ?? trip.idle_seconds ?? 0),
          startAddress: trip.start_address ?? null,
          endAddress: trip.end_address ?? null,
          points,
          events,
          bounds: { south, west, north, east },
        };

        setData(out);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[useTripReplay]", e);
        setError(e?.message ?? "Erro ao carregar viagem");
        setData(null);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tripId]);

  return { data, loading, error };
}

export function speedBand(mph: number): string {
  if (mph < 35) return "#f59e0b";
  if (mph < 45) return "#22c55e";
  if (mph < 50) return "#3b82f6";
  if (mph < 65) return "#ec4899";
  return "#ef4444";
}
