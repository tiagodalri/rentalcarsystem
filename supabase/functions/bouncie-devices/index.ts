// Returns list of Bouncie devices/vehicles from the Bouncie API,
// using the stored OAuth token (refreshes via stored authorization_code if needed).
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOUNCIE_CLIENT_ID = Deno.env.get("BOUNCIE_CLIENT_ID")!;
const BOUNCIE_CLIENT_SECRET = Deno.env.get("BOUNCIE_CLIENT_SECRET")!;
const BOUNCIE_REDIRECT_URI = Deno.env.get("BOUNCIE_REDIRECT_URI")!;

import { buildCorsHeaders } from "../_shared/cors.ts";
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
  console.log("[bouncie-devices] token refresh status", tokenResp.status);
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
  const corsHeaders = buildCorsHeaders(req);
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

    const devices = (list || []).map((v) => ({
      imei: v?.imei ?? v?.device?.imei ?? null,
      vin: v?.vin ?? null,
      model: v?.model?.name ?? v?.model ?? null,
      make: v?.model?.make ?? v?.make ?? null,
      year: v?.model?.year ?? v?.year ?? null,
      nickName: v?.nickName ?? null,
      address: v?.stats?.location?.address ?? null,
    })).filter((d) => d.imei);

    return new Response(JSON.stringify({ ok: true, devices }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message ?? "unknown";
    console.error("[bouncie-devices] error:", msg);
    // Graceful fallback: no integration configured yet, or upstream unavailable.
    // Return 200 with empty devices so the client UI (unlinked devices panel)
    // simply renders nothing instead of blowing up with a 500.
    return new Response(
      JSON.stringify({ ok: true, devices: [], fallback: true, reason: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
