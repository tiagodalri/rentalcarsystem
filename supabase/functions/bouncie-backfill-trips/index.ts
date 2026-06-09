// Phase B — Backfill histórico de viagens da Bouncie para todos os veículos com IMEI.
// POST { days?: number (default 180), imei?: string (opcional, para testar), chunkDays?: number (default 7) }
// Pagina semana a semana para trás, upsert idempotente em vehicle_trips por transaction_id.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOUNCIE_CLIENT_ID = Deno.env.get("BOUNCIE_CLIENT_ID")!;
const BOUNCIE_CLIENT_SECRET = Deno.env.get("BOUNCIE_CLIENT_SECRET")!;
const BOUNCIE_REDIRECT_URI = Deno.env.get("BOUNCIE_REDIRECT_URI")!;

const cors = {
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
      client_id: BOUNCIE_CLIENT_ID, client_secret: BOUNCIE_CLIENT_SECRET,
      grant_type: "authorization_code", code: integ.authorization_code,
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

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapTrip(vehicleId: string, imei: string, trip: any) {
  const startedAt = trip.startTime ? new Date(trip.startTime).toISOString() : null;
  const endedAt = trip.endTime ? new Date(trip.endTime).toISOString() : null;
  const duration = startedAt && endedAt
    ? Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
    : null;

  const coords: number[][] | null = trip?.gps?.coordinates && Array.isArray(trip.gps.coordinates)
    ? trip.gps.coordinates : null;
  const first = coords && coords.length > 0 ? coords[0] : null;
  const last = coords && coords.length > 0 ? coords[coords.length - 1] : null;
  // GeoJSON é [lon, lat]
  const startLng = first ? num(first[0]) : null;
  const startLat = first ? num(first[1]) : null;
  const endLng = last ? num(last[0]) : null;
  const endLat = last ? num(last[1]) : null;

  const distanceMi = num(trip.distance);
  const fuelGal = num(trip.fuelConsumed);
  const avgMpg = distanceMi !== null && fuelGal && fuelGal > 0
    ? Number((distanceMi / fuelGal).toFixed(2)) : null;

  return {
    id: String(trip.transactionId),
    transaction_id: String(trip.transactionId),
    vehicle_id: vehicleId,
    imei,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: duration,
    distance_mi: distanceMi,
    max_speed_mph: num(trip.maxSpeed),
    avg_speed_mph: num(trip.averageSpeed),
    start_odometer: num(trip.startOdometer),
    end_odometer: num(trip.endOdometer),
    fuel_consumed_gal: fuelGal,
    average_mpg: avgMpg,
    idle_seconds: num(trip.totalIdleDuration),
    hard_braking: num(trip.hardBrakingCount) ?? 0,
    hard_accel: num(trip.hardAccelerationCount) ?? 0,
    start_lat: startLat, start_lng: startLng,
    end_lat: endLat, end_lng: endLng,
    start_address: null,
    end_address: null,
    time_zone_offset: trip.timeZone ?? null,
    gps: trip.gps ?? null,
    raw: trip,
  };
}

async function fetchTripsWindow(token: string, imei: string, startsAfter: string, endsBefore: string) {
  const url = `https://api.bouncie.dev/v1/trips?imei=${encodeURIComponent(imei)}&starts-after=${encodeURIComponent(startsAfter)}&ends-before=${encodeURIComponent(endsBefore)}&gps-format=geojson`;
  const resp = await fetch(url, { headers: { Authorization: token } });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`trips ${resp.status} for ${imei}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const startedAtRun = Date.now();
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const totalDays = Math.max(1, Math.min(1, Number(body?.days ?? 1)));
    const chunkDays = Math.max(1, Math.min(1, Number(body?.chunkDays ?? 1)));
    const onlyImei: string | undefined = body?.imei;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = await getToken(admin);

    let vehiclesQuery = admin.from("vehicles")
      .select("id, bouncie_imei, license_plate, brand, model")
      .not("bouncie_imei", "is", null);
    if (onlyImei) vehiclesQuery = vehiclesQuery.eq("bouncie_imei", onlyImei);
    const { data: vehicles, error: vErr } = await vehiclesQuery;
    if (vErr) throw vErr;
    if (!vehicles || vehicles.length === 0) throw new Error("no vehicles with bouncie_imei found");

    const now = Date.now();
    const oldest = now - totalDays * 86400_000;
    const chunkMs = chunkDays * 86400_000;

    const summary: any[] = [];
    let grandUpserted = 0;
    let grandFetched = 0;
    const errors: any[] = [];

    for (const v of vehicles) {
      const imei = v.bouncie_imei as string;
      let vFetched = 0, vUpserted = 0;
      let cursorEnd = now;
      while (cursorEnd > oldest) {
        const cursorStart = Math.max(oldest, cursorEnd - chunkMs);
        const startsAfter = new Date(cursorStart).toISOString();
        const endsBefore = new Date(cursorEnd).toISOString();
        try {
          const trips = await fetchTripsWindow(token, imei, startsAfter, endsBefore);
          const list = Array.isArray(trips) ? trips : [];
          vFetched += list.length;
          if (list.length > 0) {
            const rows = list
              .filter((t: any) => t && t.transactionId && t.startTime && t.endTime)
              .map((t: any) => mapTrip(v.id, imei, t));
            if (rows.length > 0) {
              const { error: upErr } = await admin.from("vehicle_trips")
                .upsert(rows, { onConflict: "id" });
              if (upErr) {
                errors.push({ imei, window: { startsAfter, endsBefore }, error: upErr.message });
              } else {
                vUpserted += rows.length;
              }
            }
          }
        } catch (e) {
          errors.push({ imei, window: { startsAfter, endsBefore }, error: (e as Error).message });
        }
        cursorEnd = cursorStart;
        // pequeno respiro para não estourar rate limit
        await new Promise((r) => setTimeout(r, 120));
      }
      grandFetched += vFetched;
      grandUpserted += vUpserted;
      summary.push({
        vehicle_id: v.id, imei, plate: v.license_plate,
        label: [v.brand, v.model].filter(Boolean).join(" "),
        fetched: vFetched, upserted: vUpserted,
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      ran_in_seconds: Math.round((Date.now() - startedAtRun) / 1000),
      days: totalDays,
      chunk_days: chunkDays,
      vehicles_processed: vehicles.length,
      total_fetched: grandFetched,
      total_upserted: grandUpserted,
      errors_count: errors.length,
      errors: errors.slice(0, 20),
      summary,
    }, null, 2), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
