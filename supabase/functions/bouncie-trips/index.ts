// Bouncie historical trips — fetches /trips per vehicle and upserts vehicle_trips.
// Usage: POST { vehicleId?: string, days?: number, imei?: string }
// If vehicleId omitted, processes all vehicles with bouncie_imei.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOUNCIE_CLIENT_ID = Deno.env.get("BOUNCIE_CLIENT_ID")!;
const BOUNCIE_CLIENT_SECRET = Deno.env.get("BOUNCIE_CLIENT_SECRET")!;
const BOUNCIE_REDIRECT_URI = Deno.env.get("BOUNCIE_REDIRECT_URI")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getToken(admin: any): Promise<string> {
  const { data: integ } = await admin
    .from("bouncie_integration")
    .select("access_token, token_expires_at, authorization_code")
    .eq("id", 1).maybeSingle();
  if (!integ) throw new Error("bouncie_integration row missing");
  const exp = integ.token_expires_at ? new Date(integ.token_expires_at).getTime() : 0;
  if (integ.access_token && exp > Date.now()) return integ.access_token;

  if (!integ.authorization_code) throw new Error("no authorization_code on file");
  const resp = await fetch("https://auth.bouncie.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: BOUNCIE_CLIENT_ID,
      client_secret: BOUNCIE_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: integ.authorization_code,
      redirect_uri: BOUNCIE_REDIRECT_URI,
    }),
  });
  const body = await resp.text();
  if (!resp.ok) throw new Error(`token refresh ${resp.status}: ${body}`);
  const parsed = JSON.parse(body);
  const token = parsed.access_token as string;
  const expiresAt = parsed.expires_in
    ? new Date(Date.now() + (parsed.expires_in - 60) * 1000).toISOString() : null;
  await admin.from("bouncie_integration").update({
    access_token: token, token_expires_at: expiresAt, updated_at: new Date().toISOString(),
  }).eq("id", 1);
  return token;
}

// Sample GPS points down to maxPoints
function sampleGps(points: any[] | null | undefined, maxPoints = 500): any[] | null {
  if (!Array.isArray(points) || points.length === 0) return null;
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const out: any[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(points[Math.floor(i * step)]);
  // Always include the last point
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

async function fetchTripsForImei(token: string, imei: string, days: number) {
  // Bouncie /trips requires start/end within 7 days — chunk into weekly windows.
  const WINDOW_DAYS = 7;
  const now = Date.now();
  const startMs = now - days * 86400_000;
  const all: any[] = [];
  const errors: string[] = [];

  for (let cursor = startMs; cursor < now; cursor += WINDOW_DAYS * 86400_000) {
    const winStart = new Date(cursor).toISOString();
    const winEnd = new Date(Math.min(cursor + WINDOW_DAYS * 86400_000, now)).toISOString();
    const url = `https://api.bouncie.dev/v1/trips?imei=${encodeURIComponent(imei)}&starts-after=${encodeURIComponent(winStart)}&ends-before=${encodeURIComponent(winEnd)}&gps-format=polyline`;
    const resp = await fetch(url, { headers: { Authorization: token } });
    if (!resp.ok) {
      const txt = await resp.text();
      errors.push(`${winStart.slice(0,10)}..${winEnd.slice(0,10)}: ${resp.status} ${txt.slice(0,120)}`);
      continue;
    }
    const arr = await resp.json() as any[];
    if (Array.isArray(arr)) all.push(...arr);
  }
  if (errors.length && all.length === 0) {
    throw new Error(`all windows failed: ${errors.join(" | ")}`);
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const days = Math.max(1, Math.min(120, Number(body?.days ?? 30)));
    const onlyVehicleId: string | undefined = body?.vehicleId;
    const onlyImei: string | undefined = body?.imei;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = await getToken(admin);

    let q = admin.from("vehicles").select("id, bouncie_imei").not("bouncie_imei", "is", null);
    if (onlyVehicleId) q = q.eq("id", onlyVehicleId);
    if (onlyImei) q = q.eq("bouncie_imei", onlyImei);
    const { data: vehicles, error: vErr } = await q;
    if (vErr) throw vErr;

    let inserted = 0, totalFetched = 0, vehiclesProcessed = 0;
    const errors: any[] = [];

    for (const v of vehicles ?? []) {
      if (!v.bouncie_imei) continue;
      vehiclesProcessed++;
      try {
        const trips = await fetchTripsForImei(token, v.bouncie_imei, days);
        totalFetched += trips.length;
        for (const t of trips) {
          const tripId: string = t.transactionId ?? t.tripId ?? t.id;
          if (!tripId) continue;

          const startTime = t.startTime ?? t.start?.time ?? null;
          const endTime = t.endTime ?? t.end?.time ?? null;
          const duration = startTime && endTime
            ? Math.max(0, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000))
            : null;

          const gps = sampleGps(t.gpsData ?? t.gps ?? t.path ?? null);

          const row = {
            id: tripId,
            transaction_id: tripId,
            vehicle_id: v.id,
            imei: v.bouncie_imei,
            started_at: startTime,
            ended_at: endTime,
            duration_seconds: duration,
            distance_mi: t.distance ?? null,
            hard_braking: t.hardBrakingCount ?? null,
            hard_accel: t.hardAccelerationCount ?? t.hardAccelCount ?? null,
            fuel_consumed_gal: t.fuelConsumed ?? null,
            average_mpg: t.averageMpg ?? null,
            max_speed_mph: t.maxSpeed ?? null,
            avg_speed_mph: t.averageSpeed ?? null,
            idle_seconds: t.idleTime ?? null,
            start_address: t.startAddress ?? t.start?.address ?? null,
            end_address: t.endAddress ?? t.end?.address ?? null,
            start_lat: t.startLat ?? t.start?.lat ?? null,
            start_lng: t.startLon ?? t.start?.lon ?? t.start?.lng ?? null,
            end_lat: t.endLat ?? t.end?.lat ?? null,
            end_lng: t.endLon ?? t.end?.lon ?? t.end?.lng ?? null,
            start_odometer: t.startOdometer ?? null,
            end_odometer: t.endOdometer ?? null,
            gps,
            raw: t,
          };

          const { error: upErr } = await admin
            .from("vehicle_trips").upsert(row, { onConflict: "id" });
          if (upErr) errors.push({ tripId, err: upErr.message });
          else inserted++;
        }
      } catch (e) {
        errors.push({ vehicleId: v.id, err: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({
      ok: true, days, vehiclesProcessed, totalFetched, inserted, errors,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[bouncie-trips] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
