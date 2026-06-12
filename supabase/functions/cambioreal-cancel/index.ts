import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_ID = Deno.env.get("CAMBIOREAL_APP_ID") || "1781587732";
const BASE_URL = Deno.env.get("CAMBIOREAL_BASE_URL") || "https://www.cambioreal.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const secret = (Deno.env.get("CAMBIOREAL_APP_SECRET") || "").trim();
    if (!secret) return json({ error: "CAMBIOREAL_APP_SECRET not set" }, 500);

    const body = await req.json().catch(() => ({}));
    let { token, booking_id } = body as { token?: string; booking_id?: string };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!token && booking_id) {
      const { data: pr } = await supabase
        .from("payment_requests")
        .select("cr_token")
        .eq("booking_id", booking_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      token = pr?.cr_token ?? undefined;
    }
    if (!token) return json({ error: "token or booking_id required" }, 400);

    const basic = btoa(`${APP_ID}:${secret}`);
    const r = await fetch(`${BASE_URL}/service/v1/checkout/cancel/${token}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: "application/json",
      },
    });
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* keep null */ }

    const { data: pr } = await supabase
      .from("payment_requests")
      .select("id, booking_id, status")
      .eq("cr_token", token)
      .maybeSingle();

    if (pr) {
      await supabase
        .from("payment_requests")
        .update({ status: "SOLICITACAO_CANCELADA", raw: parsed })
        .eq("id", pr.id);
      if (pr.booking_id) {
        await supabase
          .from("bookings")
          .update({ status: "cancelled", hold_expires_at: null })
          .eq("id", pr.booking_id);
      }
    }

    return json({ ok: r.ok, http_status: r.status, cr_response: parsed ?? text });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
