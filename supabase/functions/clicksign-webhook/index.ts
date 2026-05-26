import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => null) as any;
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

    const { error } = await admin
      .from("bookings")
      .update(update)
      .eq("clicksign_envelope_id", envelopeId);

    if (error) console.error("[clicksign-webhook] update error:", error.message);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("[clicksign-webhook] error:", e);
    // Always 200 so Clicksign doesn't retry endlessly on parse errors
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  }
});
