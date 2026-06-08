// Bouncie webhook receiver — accepts events and updates telemetry + history.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    if (s) return s;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const raw = await req.text();
    let payload: any = {};
    try { payload = JSON.parse(raw); } catch { /* ignore */ }

    const eventType: string | null = pickString(
      payload?.eventType, payload?.event, payload?.type,
    );
    const imei: string | null = pickString(
      payload?.imei, payload?.device?.imei, payload?.vehicle?.imei,
    );

    console.log("[bouncie-webhook] event=", eventType, "imei=", imei);

    if (!imei) {
      // Acknowledge so Bouncie doesn't retry forever.
      return new Response(JSON.stringify({ ok: true, ignored: "no_imei" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find vehicle by imei
    const { data: veh } = await admin
      .from("vehicles")
      .select("id")
      .eq("bouncie_imei", imei)
      .maybeSingle();

    const vehicleId: string | null = veh?.id ?? null;

    // Extract common GPS fields (locations can be nested in many shapes)
    const loc = payload?.location ?? payload?.gps ?? payload?.stats?.location ?? null;
    const lat = pickNumber(payload?.lat, payload?.latitude, loc?.lat, loc?.latitude);
    const lng = pickNumber(payload?.lon, payload?.lng, payload?.longitude, loc?.lon, loc?.lng, loc?.longitude);
    const heading = pickNumber(payload?.heading, loc?.heading, payload?.bearing);
    const speed = pickNumber(payload?.speed, loc?.speed, payload?.stats?.speed);
    const isRunning = pickBool(payload?.isRunning, payload?.stats?.isRunning, payload?.running);
    const address = pickString(payload?.address, loc?.address, payload?.stats?.location?.address);
    const milOn = pickBool(payload?.mil?.on, payload?.stats?.mil?.milOn, payload?.milOn);
    const battery = pickString(payload?.battery?.status, payload?.stats?.battery?.status);
    const odometer = pickNumber(payload?.odometer, payload?.stats?.odometer);
    const fuelLevel = pickNumber(payload?.fuelLevel, payload?.stats?.fuelLevel);
    const reportedAtRaw = pickString(payload?.timestamp, payload?.time, payload?.reportedAt, payload?.eventTime);
    const reportedAt = reportedAtRaw ? new Date(reportedAtRaw).toISOString() : new Date().toISOString();

    if (vehicleId) {
      // Telemetry upsert — only set columns we actually parsed (avoid wiping good values)
      const update: Record<string, any> = {
        vehicle_id: vehicleId,
        imei,
        last_event: eventType,
        reported_at: reportedAt,
        updated_at: new Date().toISOString(),
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

      const { error: upErr } = await admin
        .from("vehicle_telemetry")
        .upsert(update, { onConflict: "vehicle_id" });
      if (upErr) console.error("[bouncie-webhook] telemetry upsert error:", upErr.message);

      // History — always insert the raw payload
      await admin.from("vehicle_telemetry_history").insert({
        vehicle_id: vehicleId,
        lat, lng, speed, heading,
        event_type: eventType,
        reported_at: reportedAt,
        raw: payload,
      });

      // tripEnd → upsert trip
      if (eventType === "tripEnd" || eventType === "trip-end") {
        const tripId = pickString(
          payload?.transactionId, payload?.trip?.transactionId, payload?.tripId, payload?.id,
        );
        if (tripId) {
          await admin.from("vehicle_trips").upsert({
            id: tripId,
            vehicle_id: vehicleId,
            imei,
            started_at: pickString(payload?.startTime, payload?.trip?.startTime) ?? null,
            ended_at: pickString(payload?.endTime, payload?.trip?.endTime) ?? reportedAt,
            distance_mi: pickNumber(payload?.distance, payload?.trip?.distance),
            hard_braking: pickNumber(payload?.hardBrakingCount, payload?.trip?.hardBrakingCount) as any,
            hard_accel: pickNumber(payload?.hardAccelCount, payload?.trip?.hardAccelCount) as any,
            gps: payload?.gps ?? payload?.trip?.gps ?? null,
            raw: payload,
          });
        }
      }
    } else {
      // Unknown IMEI — still log raw for debugging
      await admin.from("vehicle_telemetry_history").insert({
        vehicle_id: null,
        lat, lng, speed, heading,
        event_type: eventType,
        reported_at: reportedAt,
        raw: payload,
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
