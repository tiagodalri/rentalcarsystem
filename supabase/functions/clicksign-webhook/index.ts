import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLICKSIGN_WEBHOOK_SECRET = Deno.env.get("CLICKSIGN_WEBHOOK_SECRET") ?? "";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function computeHmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const rawBody = await req.text();

    // HMAC validation
    if (!CLICKSIGN_WEBHOOK_SECRET) {
      console.error("[clicksign-webhook] CLICKSIGN_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "server misconfigured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const headerSig =
      req.headers.get("Content-Hmac") ??
      req.headers.get("content-hmac") ??
      "";
    const providedHex = headerSig.startsWith("sha256=") ? headerSig.slice(7) : headerSig;
    const expectedHex = await computeHmacSha256Hex(CLICKSIGN_WEBHOOK_SECRET, rawBody);

    if (!providedHex || !timingSafeEqual(providedHex.toLowerCase(), expectedHex.toLowerCase())) {
      console.warn("[clicksign-webhook] invalid HMAC signature");
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    let payload: any = null;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }
    if (!payload) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    // Clicksign v3 webhook shape: { event: { name: "...", data: {...} }, document?, envelope?, ... }
    const eventName: string | undefined =
      payload?.event?.name ?? payload?.event ?? payload?.name;

    const envelopeId: string | undefined =
      payload?.envelope?.id ??
      payload?.data?.envelope?.id ??
      payload?.event?.data?.envelope?.id ??
      payload?.event?.data?.envelope_id ??
      payload?.envelope_id;

    console.log("[clicksign-webhook] event=", eventName, "envelope=", envelopeId);

    if (!envelopeId || !eventName) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const update: Record<string, any> = {};
    switch (eventName) {
      case "auto_close":
      case "envelope_closed":
      case "close":
        update.contract_status = "signed";
        update.contract_signed_at = new Date().toISOString();
        break;
      case "sign":
      case "signer_signed":
        update.contract_status = "partially_signed";
        break;
      case "cancel":
      case "refusal":
      case "envelope_cancelled":
      case "deadline":
        update.contract_status = "cancelled";
        break;
      default:
        // ignore other events
        return new Response(JSON.stringify({ ok: true, ignored: eventName }), { status: 200, headers: corsHeaders });
    }

    // Idempotency: if already signed, do not reprocess "signed" updates
    if (update.contract_status === "signed") {
      const { data: existing } = await admin
        .from("bookings")
        .select("contract_status")
        .eq("clicksign_envelope_id", envelopeId)
        .maybeSingle();
      if (existing?.contract_status === "signed") {
        console.log("[clicksign-webhook] already signed, skipping");
        return new Response(JSON.stringify({ ok: true, idempotent: true }), { status: 200, headers: corsHeaders });
      }
    }

    const { error } = await admin
      .from("bookings")
      .update(update)
      .eq("clicksign_envelope_id", envelopeId);

    if (error) console.error("[clicksign-webhook] update error:", error.message);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("[clicksign-webhook] error:", e);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  }
});
