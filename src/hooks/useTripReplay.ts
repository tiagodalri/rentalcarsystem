import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";

export type ReplayPoint = {
  lat: number;
  lng: number;
  /** ms from trip start */
  t: number;
  /** mph — real (level 2) or derived from segment length & uniform time (level 1) */
  speed: number;
  /** degrees, 0=N */
  heading: number;
  /** meters from start, cumulative */
  dist: number;
};

export type ReplayEvent = {
  kind: "start" | "end" | "hard_brake" | "hard_accel" | "stop" | "peak_speed";
  t: number;
  lat: number;
  lng: number;
  speed?: number;
  durationMs?: number;
  label: string;
};

export type ReplayLevel = 1 | 2;

export type ReplayData = {
  tripId: string;
  /** 1 = resumido (só /trips), 2 = detalhado (telemetria ponto-a-ponto) */
  level: ReplayLevel;
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
  timeZone: string;
  startOdometerMi: number | null;
  endOdometerMi: number | null;
  fuelConsumedGal: number | null;
  avgMpg: number | null;
  points: ReplayPoint[];
  events: ReplayEvent[];
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

/** Geocode helper — uses Google maps loaded API, caches in localStorage. */
async function reverseGeocodeCached(lat: number, lng: number): Promise<string | null> {
  try {
    const key = `zrc:geocode:${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = localStorage.getItem(key);
    if (cached) return cached;
    const google = await loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();
    const res: any = await new Promise((resolve, reject) => {
      geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
        if (status === "OK" && results?.[0]) resolve(results[0]);
        else reject(new Error(status));
      });
    });
    const addr: string = res?.formatted_address ?? null;
    if (addr) localStorage.setItem(key, addr);
    return addr;
  } catch {
    return null;
  }
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

    // =========================================================================
    // LIVE MODE — tripId formatted as "live:<vehicleId>". Builds a level-2
    // replay directly from vehicle_telemetry_history (no vehicle_trips row
    // exists yet because the trip is still in progress). Re-polls every 15s
    // to pick up new points as they arrive.
    // =========================================================================
    if (tripId.startsWith("live:")) {
      const vehicleId = tripId.slice(5);
      let intervalId: number | null = null;

      const buildLive = async () => {
        try {
          await loadGoogleMaps(); // ensure maps + geometry available downstream
          // 1) Find latest tripStart
          const { data: starts } = await supabase
            .from("vehicle_telemetry_history")
            .select("reported_at")
            .eq("vehicle_id", vehicleId)
            .eq("event_type", "tripStart")
            .order("reported_at", { ascending: false })
            .limit(1);
          const startedAt = starts?.[0]?.reported_at
            ? new Date(starts[0].reported_at)
            : new Date(Date.now() - 4 * 3600_000); // fallback: 4h window

          // 2) Telemetry since tripStart
          const { data: rows } = await supabase
            .from("vehicle_telemetry_history")
            .select("lat,lng,speed,heading,reported_at")
            .eq("vehicle_id", vehicleId)
            .gte("reported_at", startedAt.toISOString())
            .not("lat", "is", null)
            .order("reported_at", { ascending: true })
            .limit(5000);
          if (cancelled) return;

          const pts = (rows ?? [])
            .filter((r: any) => r.lat != null && r.lng != null)
            .map((r: any) => ({
              lat: Number(r.lat),
              lng: Number(r.lng),
              speed: Number(r.speed ?? 0),
              heading: r.heading != null ? Number(r.heading) : null,
              t: new Date(r.reported_at).getTime() - startedAt.getTime(),
            }))
            .sort((a, b) => a.t - b.t);

          if (pts.length < 2) {
            if (cancelled) return;
            setError("A viagem ao vivo ainda não recebeu pontos suficientes.");
            setLoading(false);
            return;
          }

          const endedAt = new Date(startedAt.getTime() + pts[pts.length - 1].t);
          const durationMs = Math.max(60_000, endedAt.getTime() - startedAt.getTime());

          const cum: number[] = new Array(pts.length);
          cum[0] = 0;
          for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + haversine(pts[i - 1], pts[i]);

          const points: ReplayPoint[] = pts.map((p, i) => {
            let hdg = p.heading ?? 0;
            if (p.heading == null) {
              const a = pts[Math.max(0, i - 1)];
              const b = pts[Math.min(pts.length - 1, i + 1)];
              hdg = bearing(a, b);
            }
            return {
              lat: p.lat, lng: p.lng,
              t: Math.max(0, Math.min(durationMs, p.t)),
              speed: Math.max(0, p.speed), heading: hdg, dist: cum[i],
            };
          });
          const n = points.length;

          // Geocode start/last on demand (cached)
          const startAddress = await reverseGeocodeCached(points[0].lat, points[0].lng);
          const endAddress = await reverseGeocodeCached(points[n - 1].lat, points[n - 1].lng);
          if (cancelled) return;

          let peakIdx = 0;
          for (let i = 1; i < n; i++) if (points[i].speed > points[peakIdx].speed) peakIdx = i;

          const events: ReplayEvent[] = [
            {
              kind: "start", t: 0, lat: points[0].lat, lng: points[0].lng, speed: points[0].speed,
              label: `Partida .  ${startedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" })}`,
            },
          ];
          if (points[peakIdx].speed > 10) {
            events.push({
              kind: "peak_speed", t: points[peakIdx].t,
              lat: points[peakIdx].lat, lng: points[peakIdx].lng, speed: points[peakIdx].speed,
              label: `Pico .  ${Math.round(points[peakIdx].speed)} mph`,
            });
          }
          events.sort((a, b) => a.t - b.t);

          let south = points[0].lat, north = points[0].lat, west = points[0].lng, east = points[0].lng;
          for (const p of points) {
            if (p.lat < south) south = p.lat;
            if (p.lat > north) north = p.lat;
            if (p.lng < west) west = p.lng;
            if (p.lng > east) east = p.lng;
          }

          const totalDistanceMi = (cum[cum.length - 1] / 1609.34);
          const avgSpeedMph = points.reduce((s, p) => s + p.speed, 0) / n;

          const out: ReplayData = {
            tripId,
            level: 2,
            startedAt,
            endedAt,
            durationMs,
            totalDistanceMi,
            avgSpeedMph,
            maxSpeedMph: points[peakIdx].speed,
            hardBrakes: 0,
            hardAccels: 0,
            totalIdleSeconds: 0,
            startAddress,
            endAddress,
            timeZone: "America/New_York",
            startOdometerMi: null,
            endOdometerMi: null,
            fuelConsumedGal: null,
            avgMpg: null,
            points,
            events,
            bounds: { south, west, north, east },
          };
          if (cancelled) return;
          setData(out);
          setLoading(false);
        } catch (e: any) {
          if (cancelled) return;
          console.error("[useTripReplay live]", e);
          setError(e?.message ?? "Erro ao carregar viagem ao vivo");
          setLoading(false);
        }
      };

      buildLive();
      intervalId = window.setInterval(buildLive, 15_000);
      return () => { cancelled = true; if (intervalId) clearInterval(intervalId); };
    }

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

        // Bouncie pode devolver `gps` em 3 formatos:
        //  - string (polyline codificada)
        //  - GeoJSON LineString { type:"LineString", coordinates:[[lng,lat], ...] }
        //  - array cru de [lng,lat]
        const gpsAny: any = raw.gps ?? trip.gps ?? null;
        let raw_points: { lat: number; lng: number }[] = [];

        if (typeof gpsAny === "string" && gpsAny.length > 0) {
          const decoded: any[] = google.maps.geometry.encoding.decodePath(gpsAny);
          raw_points = decoded.map((p) => ({ lat: p.lat(), lng: p.lng() }));
        } else if (gpsAny && Array.isArray(gpsAny.coordinates)) {
          raw_points = gpsAny.coordinates
            .filter((c: any) => Array.isArray(c) && c.length >= 2)
            .map((c: any) => ({ lat: Number(c[1]), lng: Number(c[0]) }))
            .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        } else if (Array.isArray(gpsAny)) {
          raw_points = gpsAny
            .filter((c: any) => Array.isArray(c) && c.length >= 2)
            .map((c: any) => ({ lat: Number(c[1]), lng: Number(c[0]) }))
            .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        }

        const startedAt = trip.started_at ? new Date(trip.started_at) : new Date();
        const endedAt = trip.ended_at ? new Date(trip.ended_at) : new Date(startedAt.getTime() + 60000);
        const durationMs = Math.max(60000, endedAt.getTime() - startedAt.getTime());
        const tz: string = (raw.timeZone as string) || "America/New_York";

        // ===== Try to fetch real telemetry points to upgrade to LEVEL 2 =====
        let level: ReplayLevel = 1;
        let realPts: { lat: number; lng: number; speed: number; heading: number | null; t: number }[] = [];
        if (trip.vehicle_id) {
          const { data: th } = await supabase
            .from("vehicle_telemetry_history")
            .select("lat,lng,speed,heading,reported_at")
            .eq("vehicle_id", trip.vehicle_id)
            .gte("reported_at", startedAt.toISOString())
            .lte("reported_at", endedAt.toISOString())
            .order("reported_at", { ascending: true })
            .limit(3000);
          // If we have no polyline, accept even a small set of telemetry points
          const minPts = raw_points.length >= 2 ? 8 : 2;
          if (th && th.length >= minPts) {
            const withCoords = th.filter((r: any) => r.lat != null && r.lng != null);
            if (withCoords.length >= minPts) {
              level = 2;
              realPts = withCoords.map((r: any) => ({
                lat: Number(r.lat),
                lng: Number(r.lng),
                speed: r.speed != null ? Number(r.speed) : 0,
                heading: r.heading != null ? Number(r.heading) : null,
                t: new Date(r.reported_at).getTime() - startedAt.getTime(),
              }));
            }
          }
        }

        if (level !== 2 && raw_points.length < 2) {
          throw new Error("Esta viagem não tem rota gravada nem telemetria suficiente para reproduzir.");
        }

        // ===== Downsample very long polylines (level 1) =====
        const MAX_PTS = 600;
        if (raw_points.length > MAX_PTS) {
          const step = raw_points.length / MAX_PTS;
          const out: typeof raw_points = [];
          for (let i = 0; i < MAX_PTS; i++) out.push(raw_points[Math.floor(i * step)]);
          if (out[out.length - 1] !== raw_points[raw_points.length - 1]) out.push(raw_points[raw_points.length - 1]);
          raw_points = out;
        }

        // ===== Build points =====
        let points: ReplayPoint[];
        if (level === 2 && realPts.length >= 8) {
          // Sort + cumulative distance + heading fallback
          realPts.sort((a, b) => a.t - b.t);
          const cum: number[] = new Array(realPts.length);
          cum[0] = 0;
          for (let i = 1; i < realPts.length; i++) {
            cum[i] = cum[i - 1] + haversine(realPts[i - 1], realPts[i]);
          }
          points = realPts.map((p, i) => {
            let hdg = p.heading ?? 0;
            if (p.heading == null) {
              const a = realPts[Math.max(0, i - 1)];
              const b = realPts[Math.min(realPts.length - 1, i + 1)];
              hdg = bearing(a, b);
            }
            return {
              lat: p.lat,
              lng: p.lng,
              t: Math.max(0, Math.min(durationMs, p.t)),
              speed: Math.max(0, p.speed),
              heading: hdg,
              dist: cum[i],
            };
          });
        } else {
          // LEVEL 1 — uniform-time interpolation along polyline
          const n = raw_points.length;
          const dt = durationMs / (n - 1);
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
          const ptSpeedRaw: number[] = new Array(n);
          ptSpeedRaw[0] = segSpeedMph[0] ?? 0;
          ptSpeedRaw[n - 1] = segSpeedMph[n - 2] ?? 0;
          for (let i = 1; i < n - 1; i++) ptSpeedRaw[i] = (segSpeedMph[i - 1] + segSpeedMph[i]) / 2;
          const ptSpeed: number[] = ptSpeedRaw.map((_, i) => {
            const a = ptSpeedRaw[Math.max(0, i - 1)];
            const b = ptSpeedRaw[i];
            const c = ptSpeedRaw[Math.min(n - 1, i + 1)];
            return (a + b + c) / 3;
          });
          const ptBearing: number[] = new Array(n);
          ptBearing[0] = segBearing[0] ?? 0;
          for (let i = 1; i < n; i++) ptBearing[i] = segBearing[Math.min(i - 1, n - 2)] ?? 0;
          points = raw_points.map((p, i) => ({
            lat: p.lat,
            lng: p.lng,
            t: Math.round(i * dt),
            speed: ptSpeed[i],
            heading: ptBearing[i],
            dist: cumDist[i],
          }));
        }

        const n = points.length;

        // ===== On-demand geocoding for missing addresses (cached) =====
        let startAddress = trip.start_address ?? null;
        let endAddress = trip.end_address ?? null;
        if (!startAddress) startAddress = await reverseGeocodeCached(points[0].lat, points[0].lng);
        if (!endAddress) endAddress = await reverseGeocodeCached(points[n - 1].lat, points[n - 1].lng);
        if (cancelled) return;

        // ===== Events =====
        const events: ReplayEvent[] = [];
        const shortAddr = (s: string | null | undefined) => s ? s.split(",")[0].trim() : null;
        const fmtHm = (d: Date) =>
          d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
        const startShort = shortAddr(startAddress);
        const endShort = shortAddr(endAddress);

        events.push({
          kind: "start",
          t: 0,
          lat: points[0].lat,
          lng: points[0].lng,
          speed: points[0].speed,
          label: startShort ? `Partiu de ${startShort} .  ${fmtHm(startedAt)}` : `Partida .  ${fmtHm(startedAt)}`,
        });
        events.push({
          kind: "end",
          t: points[n - 1].t,
          lat: points[n - 1].lat,
          lng: points[n - 1].lng,
          speed: points[n - 1].speed,
          label: endShort ? `Chegou em ${endShort} .  ${fmtHm(endedAt)}` : `Chegada .  ${fmtHm(endedAt)}`,
        });

        // Peak speed (both levels)
        let peakIdx = 0;
        for (let i = 1; i < n; i++) if (points[i].speed > points[peakIdx].speed) peakIdx = i;
        if (points[peakIdx].speed > 10) {
          events.push({
            kind: "peak_speed",
            t: points[peakIdx].t,
            lat: points[peakIdx].lat,
            lng: points[peakIdx].lng,
            speed: points[peakIdx].speed,
            label: `Pico de velocidade .  ${Math.round(points[peakIdx].speed)} mph`,
          });
        }

        // Brake / accel / stop pins — ONLY for level 2 (real timing). Level 1 = só contagens no resumo.
        if (level === 2) {
          for (let i = 1; i < n; i++) {
            // Find ~4s window back
            let back = i;
            while (back > 0 && points[i].t - points[back].t < 4000) back--;
            if (back === i) continue;
            const ds = points[i].speed - points[back].speed;
            const dts = (points[i].t - points[back].t) / 1000;
            if (dts < 1) continue;
            if (ds <= -12) {
              const last = [...events].reverse().find((e) => e.kind === "hard_brake");
              if (!last || points[i].t - last.t > 5000) {
                events.push({
                  kind: "hard_brake",
                  t: points[i].t,
                  lat: points[i].lat,
                  lng: points[i].lng,
                  speed: points[i].speed,
                  label: `Freada brusca .  ${Math.round(points[back].speed)} → ${Math.round(points[i].speed)} mph`,
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
                  speed: points[i].speed,
                  label: `Aceleração brusca .  ${Math.round(points[back].speed)} → ${Math.round(points[i].speed)} mph`,
                });
              }
            }
          }

          // Stops: long consecutive low-speed runs (> 3 min)
          let runStart = -1;
          for (let i = 0; i < n; i++) {
            const slow = points[i].speed < 2;
            if (slow && runStart < 0) runStart = i;
            if ((!slow || i === n - 1) && runStart >= 0) {
              const runEnd = slow ? i : i - 1;
              const durMs = points[runEnd].t - points[runStart].t;
              if (durMs > 180_000) {
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
          level,
          startedAt,
          endedAt,
          durationMs,
          totalDistanceMi: Number(trip.distance_mi ?? 0),
          avgSpeedMph: Number(raw.averageSpeed ?? trip.avg_speed_mph ?? 0),
          maxSpeedMph: Number(raw.maxSpeed ?? trip.max_speed_mph ?? points[peakIdx]?.speed ?? 0),
          hardBrakes: Number(raw.hardBrakingCount ?? trip.hard_braking ?? 0),
          hardAccels: Number(raw.hardAccelerationCount ?? trip.hard_accel ?? 0),
          totalIdleSeconds: Number(raw.totalIdleDuration ?? trip.idle_seconds ?? 0),
          startAddress,
          endAddress,
          timeZone: tz,
          startOdometerMi: trip.start_odometer != null ? Number(trip.start_odometer) : null,
          endOdometerMi: trip.end_odometer != null ? Number(trip.end_odometer) : null,
          fuelConsumedGal: trip.fuel_consumed_gal != null ? Number(trip.fuel_consumed_gal) : null,
          avgMpg: trip.average_mpg != null ? Number(trip.average_mpg) : null,
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
