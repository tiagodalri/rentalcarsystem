import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const amount = Number(body.amount);
    const payment_method = body.payment_method || "pix";
    if (!amount || amount <= 0) return json({ error: "amount required (USD)" }, 400);

    const basic = btoa(`${APP_ID}:${secret}`);
    const r = await fetch(`${BASE_URL}/service/v1/checkout/simulator`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "USD",
        take_rates: 0,
        payment_method,
      }),
    });
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* leave null */ }

    if (!r.ok) {
      return json({ error: "cambioreal error", http_status: r.status, cr_response: parsed ?? text }, 502);
    }

    const data = parsed?.data ?? parsed;
    return json({
      rate: data?.rate ?? null,
      result: data?.result ?? null,            // BRL
      iof: data?.iof ?? null,
      payment_method: data?.payment_method ?? payment_method,
      installments: data?.installments ?? null,
      estimated_delivery: data?.estimated_delivery ?? null,
      raw: parsed,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
