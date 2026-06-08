// Phase A discovery — returns raw Bouncie /trips and /vehicles payloads for one IMEI.
// POST { imei?: string, days?: number, gpsFormat?: "polyline"|"geojson" }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const days = Math.max(1, Math.min(7, Number(body?.days ?? 7)));
    const gpsFormat = body?.gpsFormat ?? "geojson";
    let imei: string | undefined = body?.imei;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = await getToken(admin);

    if (!imei) {
      const { data: v } = await admin.from("vehicles")
        .select("bouncie_imei").not("bouncie_imei", "is", null).limit(1);
      imei = v?.[0]?.bouncie_imei;
    }
    if (!imei) throw new Error("no IMEI available");

    const startsAfter = new Date(Date.now() - days * 86400_000).toISOString();
    const endsBefore = new Date().toISOString();
    const tripsUrl = `https://api.bouncie.dev/v1/trips?imei=${encodeURIComponent(imei)}&starts-after=${encodeURIComponent(startsAfter)}&ends-before=${encodeURIComponent(endsBefore)}&gps-format=${gpsFormat}`;
    const vehiclesUrl = `https://api.bouncie.dev/v1/vehicles?imei=${encodeURIComponent(imei)}`;

    const [tripsResp, vehiclesResp] = await Promise.all([
      fetch(tripsUrl, { headers: { Authorization: token } }),
      fetch(vehiclesUrl, { headers: { Authorization: token } }),
    ]);
    const tripsText = await tripsResp.text();
    const vehiclesText = await vehiclesResp.text();
    let trips: any = tripsText;
    let vehicles: any = vehiclesText;
    try { trips = JSON.parse(tripsText); } catch { /* keep text */ }
    try { vehicles = JSON.parse(vehiclesText); } catch { /* keep text */ }

    const firstTrip = Array.isArray(trips) ? trips[0] : null;
    const firstVehicle = Array.isArray(vehicles) ? vehicles[0] : vehicles;
    const tripFieldNames = firstTrip ? Object.keys(firstTrip) : [];
    const vehicleFieldNames = firstVehicle && typeof firstVehicle === "object"
      ? Object.keys(firstVehicle) : [];
    const tripGpsSample = firstTrip
      ? {
          gpsType: typeof firstTrip.gps,
          gpsIsArray: Array.isArray(firstTrip.gps),
          gpsKeys: firstTrip.gps && typeof firstTrip.gps === "object" && !Array.isArray(firstTrip.gps)
            ? Object.keys(firstTrip.gps) : null,
          firstPoint: Array.isArray(firstTrip.gps) ? firstTrip.gps[0] : null,
          pointCount: Array.isArray(firstTrip.gps) ? firstTrip.gps.length : null,
        }
      : null;

    return new Response(JSON.stringify({
      ok: true,
      imei,
      window: { startsAfter, endsBefore, days },
      gpsFormat,
      tripsStatus: tripsResp.status,
      vehiclesStatus: vehiclesResp.status,
      tripCount: Array.isArray(trips) ? trips.length : 0,
      tripFieldNames,
      vehicleFieldNames,
      tripGpsSample,
      firstTrip,
      firstVehicle,
    }, null, 2), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
