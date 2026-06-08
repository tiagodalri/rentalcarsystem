// Bouncie polling sync — refreshes token if needed, then pulls /vehicles
// and upserts vehicle_telemetry rows by IMEI.
import { createClient } from "npm:@supabase/supabase-js@2";
import { evaluateGeofences } from "../_shared/geofence.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOUNCIE_CLIENT_ID = Deno.env.get("BOUNCIE_CLIENT_ID")!;
const BOUNCIE_CLIENT_SECRET = Deno.env.get("BOUNCIE_CLIENT_SECRET")!;
const BOUNCIE_REDIRECT_URI = Deno.env.get("BOUNCIE_REDIRECT_URI")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

async function refreshTokenIfNeeded(admin: any) {
  const { data: integ, error } = await admin
    .from("bouncie_integration")
    .select("access_token, token_expires_at, authorization_code")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(`db read: ${error.message}`);
  if (!integ) throw new Error("bouncie_integration row missing");

  const now = Date.now();
  const exp = integ.token_expires_at ? new Date(integ.token_expires_at).getTime() : 0;
  if (integ.access_token && exp > now) return integ.access_token as string;

  if (!integ.authorization_code) {
    throw new Error("no authorization_code on file — complete OAuth first");
  }

  // Re-exchange the stored authorization_code (Bouncie permits this per their docs).
  const tokenResp = await fetch("https://auth.bouncie.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: BOUNCIE_CLIENT_ID,
      client_secret: BOUNCIE_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: integ.authorization_code,
      redirect_uri: BOUNCIE_REDIRECT_URI,
    }),
  });
  const body = await tokenResp.text();
  console.log("[bouncie-sync] token refresh response", tokenResp.status, body);
  if (!tokenResp.ok) throw new Error(`token refresh failed ${tokenResp.status}: ${body}`);
  const parsed = JSON.parse(body);
  const accessToken = parsed.access_token as string;
  const expiresIn = parsed.expires_in as number | undefined;
  const expiresAt = expiresIn
    ? new Date(Date.now() + (expiresIn - 60) * 1000).toISOString()
    : null;

  await admin.from("bouncie_integration").update({
    access_token: accessToken,
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);

  return accessToken;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = await refreshTokenIfNeeded(admin);

    const resp = await fetch("https://api.bouncie.dev/v1/vehicles", {
      headers: { Authorization: token },
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`bouncie GET /vehicles ${resp.status}: ${txt}`);
    }
    const list: any[] = await resp.json();

    let updated = 0;
    for (const v of list || []) {
      const imei: string | undefined = v?.imei ?? v?.device?.imei;
      if (!imei) continue;

      const { data: veh } = await admin
        .from("vehicles")
        .select("id")
        .eq("bouncie_imei", imei)
        .maybeSingle();
      if (!veh?.id) continue;

      const stats = v?.stats ?? {};
      const loc = stats?.location ?? {};
      const update: Record<string, any> = {
        vehicle_id: veh.id,
        imei,
        last_event: "sync",
        reported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (loc.lat !== undefined) update.lat = Number(loc.lat);
      if (loc.lon !== undefined) update.lng = Number(loc.lon);
      if (loc.heading !== undefined) update.heading = Number(loc.heading);
      if (loc.address !== undefined) update.address = String(loc.address);
      if (stats.speed !== undefined) update.speed = Number(stats.speed);
      if (stats.isRunning !== undefined) update.is_running = Boolean(stats.isRunning);
      if (stats.odometer !== undefined) update.odometer = Number(stats.odometer);
      if (stats.fuelLevel !== undefined) update.fuel_level = Number(stats.fuelLevel);
      if (stats.battery?.status !== undefined) update.battery_status = String(stats.battery.status);
      if (stats.mil?.milOn !== undefined) update.mil_on = Boolean(stats.mil.milOn);

      const { error: upErr } = await admin
        .from("vehicle_telemetry")
        .upsert(update, { onConflict: "vehicle_id" });
      if (upErr) {
        console.error("[bouncie-sync] upsert error:", imei, upErr.message);
      } else {
        updated += 1;
      }
    }

    return new Response(JSON.stringify({ ok: true, updated, total: list?.length ?? 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[bouncie-sync] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
