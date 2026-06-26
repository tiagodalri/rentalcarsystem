// Bouncie webhook receiver — updates telemetry, history, trips, events, diagnostics.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOUNCIE_WEBHOOK_SECRET = Deno.env.get("BOUNCIE_WEBHOOK_SECRET") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
const GEOCODE_GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const geocodeCache = new Map<string, { addr: string; t: number }>();
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) return null;
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const now = Date.now();
  const cached = geocodeCache.get(key);
  if (cached && now - cached.t < 10 * 60 * 1000) return cached.addr;
  const url = `${GEOCODE_GATEWAY}/maps/api/geocode/json?latlng=${lat},${lng}&result_type=street_address|route|premise|point_of_interest`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
    },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const addr: string | null = j?.results?.[0]?.formatted_address ?? null;
  if (addr) geocodeCache.set(key, { addr, t: now });
  return addr;
}

import { buildCorsHeaders } from "../_shared/cors.ts";
function pickNumber(...vals: any[]): number | null {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}
function pickString(...vals: any[]): string | null {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined") return s;
  }
  return null;
}
function pickBool(...vals: any[]): boolean | null {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.toLowerCase();
      if (s === "true") return true;
      if (s === "false") return false;
    }
  }
  return null;
}

// Classify Bouncie event types into severity buckets for the UI
function severityFor(eventType: string | null): string {
  if (!eventType) return "info";
  const t = eventType.toLowerCase();
  if (t.includes("mil")) return "critical";
  if (t.includes("hardbraking") || t.includes("hardaccel") || t.includes("speeding")) return "warning";
  if (t.includes("disconnect")) return "warning";
  return "info";
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const raw = await req.text();
    let payload: any = {};
    try { payload = JSON.parse(raw); } catch { /* ignore */ }

    if (BOUNCIE_WEBHOOK_SECRET) {
      const provided = pickString(
        payload?.webhookKey, payload?.webhook_key, payload?.secret,
        req.headers.get("x-webhook-key"),
        req.headers.get("x-webhook-secret"),
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""),
      );
      if (provided !== BOUNCIE_WEBHOOK_SECRET) {
        console.warn("[bouncie-webhook] forbidden: invalid webhook secret");
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const eventType: string | null = pickString(payload?.eventType, payload?.event, payload?.type);
    const imei: string | null = pickString(payload?.imei, payload?.device?.imei, payload?.vehicle?.imei);

    console.log("[bouncie-webhook] event=", eventType, "imei=", imei);

    if (!imei) {
      return new Response(JSON.stringify({ ok: true, ignored: "no_imei" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: veh } = await admin
      .from("vehicles").select("id").eq("bouncie_imei", imei).maybeSingle();
    const vehicleId: string | null = veh?.id ?? null;

    // Bouncie sends a `data[]` array of GPS samples on `tripData` events.
    // Top-level payload has NO lat/lng for those events — read from the latest sample.
    const dataArr: any[] = Array.isArray(payload?.data) ? payload.data
      : Array.isArray(payload?.gps) ? payload.gps
      : Array.isArray(payload?.gpsData) ? payload.gpsData
      : [];
    const lastSample: any = dataArr.length ? dataArr[dataArr.length - 1] : null;
    const lastSampleGps: any = lastSample?.gps ?? lastSample?.location ?? null;

    const loc = payload?.location ?? payload?.gps ?? payload?.stats?.location ?? null;
    const lat = pickNumber(payload?.lat, payload?.latitude, loc?.lat, loc?.latitude, lastSample?.lat, lastSample?.latitude, lastSampleGps?.lat, lastSampleGps?.latitude);
    const lng = pickNumber(payload?.lon, payload?.lng, payload?.longitude, loc?.lon, loc?.lng, loc?.longitude, lastSample?.lon, lastSample?.lng, lastSample?.longitude, lastSampleGps?.lon, lastSampleGps?.lng, lastSampleGps?.longitude);
    const heading = pickNumber(payload?.heading, loc?.heading, payload?.bearing, lastSample?.heading, lastSample?.bearing, lastSampleGps?.heading, lastSampleGps?.bearing);
    const speed = pickNumber(payload?.speed, loc?.speed, payload?.stats?.speed, lastSample?.speed);
    const isRunningRaw = pickBool(payload?.isRunning, payload?.stats?.isRunning, payload?.running);
    // tripData implies the vehicle is moving / engine on
    const isRunning = isRunningRaw ?? (eventType === "tripData" ? true : null);
    const address = pickString(payload?.address, loc?.address, payload?.stats?.location?.address, lastSample?.address);
    const milOn = pickBool(payload?.mil?.on, payload?.stats?.mil?.milOn, payload?.milOn);
    const battery = pickString(payload?.battery?.status, payload?.stats?.battery?.status);
    const batteryV = pickNumber(payload?.battery?.voltage, payload?.stats?.battery?.voltage);
    const odometer = pickNumber(payload?.odometer, payload?.stats?.odometer);
    const fuelLevel = pickNumber(payload?.fuelLevel, payload?.stats?.fuelLevel);
    const dtcs: string[] | null = Array.isArray(payload?.mil?.qualifiedEvents) ? payload.mil.qualifiedEvents
      : Array.isArray(payload?.dtcs) ? payload.dtcs : null;
    const reportedAtRaw = pickString(payload?.timestamp, payload?.time, payload?.reportedAt, payload?.eventTime, lastSample?.timestamp);
    const reportedAt = reportedAtRaw ? new Date(reportedAtRaw).toISOString() : new Date().toISOString();

    if (vehicleId) {
      // 1) Live telemetry
      const update: Record<string, any> = {
        vehicle_id: vehicleId, imei, last_event: eventType,
        reported_at: reportedAt, updated_at: new Date().toISOString(),
      };
      if (lat !== null) update.lat = lat;
      if (lng !== null) update.lng = lng;
      if (heading !== null) update.heading = heading;
      if (speed !== null) update.speed = speed;
      if (isRunning !== null) update.is_running = isRunning;
      if (address !== null) update.address = address;
      if (milOn !== null) update.mil_on = milOn;
      if (battery !== null) update.battery_status = battery;
      if (odometer !== null) update.odometer = odometer;
      if (fuelLevel !== null) update.fuel_level = fuelLevel;

      const { data: currentLive } = await admin
        .from("vehicle_telemetry")
        .select("reported_at")
        .eq("vehicle_id", vehicleId)
        .maybeSingle();
      const currentReportedMs = currentLive?.reported_at ? new Date(currentLive.reported_at).getTime() : 0;
      const incomingReportedMs = new Date(reportedAt).getTime();
      const staleLiveFix = currentReportedMs > incomingReportedMs;

      if (staleLiveFix) {
        console.log("[bouncie-webhook] stale live fix ignored", imei, reportedAt, "current=", currentLive?.reported_at);
      } else {
        // Reverse-geocode when bouncie didn't ship an address
        if (!update.address && lat !== null && lng !== null) {
          try {
            const geo = await reverseGeocode(lat, lng);
            if (geo) update.address = geo;
          } catch (e) {
            console.warn("[bouncie-webhook] reverse geocode failed:", (e as Error).message);
          }
        }
        const { error: upErr } = await admin
          .from("vehicle_telemetry")
          .upsert(update, { onConflict: "vehicle_id" });
        if (upErr) console.error("[bouncie-webhook] telemetry upsert error:", upErr.message);
      }

      // 2) Raw history — expand tripData `data[]` into one row per GPS sample
      if (dataArr.length > 0) {
        const rows = dataArr
          .map((s: any) => {
            const gps = s?.gps ?? s?.location ?? null;
            const sLat = pickNumber(s?.lat, s?.latitude, gps?.lat, gps?.latitude);
            const sLng = pickNumber(s?.lon, s?.lng, s?.longitude, gps?.lon, gps?.lng, gps?.longitude);
            if (sLat === null || sLng === null) return null;
            const sTs = pickString(s?.timestamp, s?.time);
            return {
              vehicle_id: vehicleId,
              lat: sLat,
              lng: sLng,
              speed: pickNumber(s?.speed),
              heading: pickNumber(s?.heading, s?.bearing, gps?.heading, gps?.bearing),
              event_type: eventType,
              reported_at: sTs ? new Date(sTs).toISOString() : reportedAt,
              raw: s,
            };
          })
          .filter((r) => r !== null);
        if (rows.length > 0) {
          await admin.from("vehicle_telemetry_history").insert(rows as any[]);
        }
      } else if (lat !== null && lng !== null) {
        await admin.from("vehicle_telemetry_history").insert({
          vehicle_id: vehicleId, lat, lng, speed, heading,
          event_type: eventType, reported_at: reportedAt, raw: payload,
        });
      }


      // 3) Structured event log (new)
      if (eventType) {
        await admin.from("vehicle_events").insert({
          vehicle_id: vehicleId,
          imei,
          event_type: eventType,
          occurred_at: reportedAt,
          lat, lng,
          speed_mph: speed,
          severity: severityFor(eventType),
          payload,
        });
      }

      // 4) Diagnostics snapshot on health-related events
      const isHealth = /mil|battery|diagnostic|connect|disconnect/i.test(eventType ?? "");
      if (isHealth || milOn !== null || batteryV !== null || dtcs !== null) {
        await admin.from("vehicle_diagnostics").insert({
          vehicle_id: vehicleId,
          imei,
          recorded_at: reportedAt,
          mil_on: milOn,
          dtc_codes: dtcs,
          battery_voltage: batteryV,
          fuel_level_pct: fuelLevel,
          odometer_mi: odometer,
          raw: payload,
        });
      }

      // 5) tripEnd → upsert enriched trip
      if (eventType === "tripEnd" || eventType === "trip-end") {
        const tripId = pickString(
          payload?.transactionId, payload?.trip?.transactionId, payload?.tripId, payload?.id,
        );
        if (tripId) {
          const startTime = pickString(payload?.startTime, payload?.trip?.startTime);
          const endTime = pickString(payload?.endTime, payload?.trip?.endTime) ?? reportedAt;
          const duration = startTime && endTime
            ? Math.max(0, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000))
            : null;

          await admin.from("vehicle_trips").upsert({
            id: tripId,
            transaction_id: tripId,
            vehicle_id: vehicleId,
            imei,
            started_at: startTime,
            ended_at: endTime,
            duration_seconds: duration,
            distance_mi: pickNumber(payload?.distance, payload?.trip?.distance),
            hard_braking: pickNumber(payload?.hardBrakingCount, payload?.trip?.hardBrakingCount) as any,
            hard_accel: pickNumber(payload?.hardAccelCount, payload?.trip?.hardAccelCount) as any,
            fuel_consumed_gal: pickNumber(payload?.fuelConsumed, payload?.trip?.fuelConsumed),
            average_mpg: pickNumber(payload?.averageMpg, payload?.trip?.averageMpg),
            max_speed_mph: pickNumber(payload?.maxSpeed, payload?.trip?.maxSpeed),
            avg_speed_mph: pickNumber(payload?.averageSpeed, payload?.trip?.averageSpeed),
            idle_seconds: pickNumber(payload?.idleTime, payload?.trip?.idleTime) as any,
            start_address: pickString(payload?.startAddress, payload?.trip?.startAddress),
            end_address: pickString(payload?.endAddress, payload?.trip?.endAddress),
            start_lat: pickNumber(payload?.startLat, payload?.trip?.startLat),
            start_lng: pickNumber(payload?.startLon, payload?.trip?.startLon),
            end_lat: pickNumber(payload?.endLat, payload?.trip?.endLat),
            end_lng: pickNumber(payload?.endLon, payload?.trip?.endLon),
            start_odometer: pickNumber(payload?.startOdometer, payload?.trip?.startOdometer),
            end_odometer: pickNumber(payload?.endOdometer, payload?.trip?.endOdometer),
            gps: payload?.gps ?? payload?.gpsData ?? payload?.trip?.gps ?? null,
            raw: payload,
          }, { onConflict: "id" });
        }
      }
    } else {
      await admin.from("vehicle_telemetry_history").insert({
        vehicle_id: null, lat, lng, speed, heading,
        event_type: eventType, reported_at: reportedAt, raw: payload,
      });
      console.warn("[bouncie-webhook] unknown IMEI", imei);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[bouncie-webhook] error:", e);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
