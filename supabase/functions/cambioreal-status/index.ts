// Câmbio Real — polling de status p/ a tela Pix/Boleto.
// Aceita { token } ou { booking_id }. Consulta GET /service/v1/checkout/get/{token}.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { buildCorsHeaders } from "../_shared/cors.ts";
const APP_ID = Deno.env.get("CAMBIOREAL_APP_ID") || "1781587732";
const BASE_URL = Deno.env.get("CAMBIOREAL_BASE_URL") || "https://www.cambioreal.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Method not allowed" }, 405);

  try {
    const secret = (Deno.env.get("CAMBIOREAL_APP_SECRET") || "").trim();
    if (!secret) return json({ error: "CAMBIOREAL_APP_SECRET not set" }, 500);

    let token: string | null = null;
    let booking_id: string | null = null;
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      token = b?.token ?? null;
      booking_id = b?.booking_id ?? null;
    } else {
      const u = new URL(req.url);
      token = u.searchParams.get("token");
      booking_id = u.searchParams.get("booking_id");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!token && booking_id) {
      const { data: pr } = await supabase
        .from("payment_requests")
        .select("cr_token, payment_method, status, booking_id")
        .eq("booking_id", booking_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      token = pr?.cr_token ?? null;
    }

    if (!token) return json({ error: "token or booking_id required" }, 400);

    const basic = btoa(`${APP_ID}:${secret}`);
    const r = await fetch(`${BASE_URL}/service/v1/checkout/get/${token}`, {
      method: "GET",
      headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
    });
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* keep null */ }
    const data = parsed?.data ?? parsed;
    const status: string = data?.status ?? "UNKNOWN";
    const payment_method = data?.payment_method ?? data?.transaction?.payment_method ?? null;
    const paid = status === "SOLICITACAO_PAGO";

    // Best-effort: sincroniza payment_requests sem confirmar booking
    // (a confirmação fica com o webhook, fonte da verdade).
    await supabase
      .from("payment_requests")
      .update({ status, payment_method, raw: parsed, paid_at: paid ? new Date().toISOString() : null })
      .eq("cr_token", token);

    return json({ status, paid, payment_method });
  } catch (e) {
    console.error("cambioreal-status error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
