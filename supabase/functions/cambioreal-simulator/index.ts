import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_ID = Deno.env.get("CAMBIOREAL_APP_ID") || "1781587732";
const BASE_URL = Deno.env.get("CAMBIOREAL_BASE_URL") || "https://www.cambioreal.com";

const MAX_RETRIES = 2; // 1 retry (worst-case ~12s)
const TIMEOUT_MS = 6_000;
const BACKOFF_MS = [500, 1500];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
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
    const url = `${BASE_URL}/service/v1/checkout/simulator`;
    const init: RequestInit = {
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
    };

    let lastErr = "";
    let lastStatus = 0;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const r = await fetchWithTimeout(url, init, TIMEOUT_MS);
        const text = await r.text();
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch { /* leave null */ }

        if (r.ok) {
          const data = parsed?.data ?? parsed;
          return json({
            rate: data?.rate ?? null,
            result: data?.result ?? null,
            iof: data?.iof ?? null,
            payment_method: data?.payment_method ?? payment_method,
            installments: data?.installments ?? null,
            estimated_delivery: data?.estimated_delivery ?? null,
            raw: parsed,
          });
        }

        lastStatus = r.status;
        lastErr = typeof parsed === "object" ? JSON.stringify(parsed) : text.slice(0, 200);

        // Don't retry on non-5xx (client errors)
        if (r.status < 500) {
          return json({
            error: `cambioreal error ${r.status}`,
            http_status: r.status,
            cr_response: parsed ?? text,
            fallback: false,
          });
        }
      } catch (e) {
        lastErr = (e as Error).message || String(e);
      }

      if (attempt < MAX_RETRIES - 1) {
        await new Promise((res) => setTimeout(res, BACKOFF_MS[attempt]));
      }
    }

    // All retries failed — return 200 with fallback flag so the UI can recover gracefully
    return json({
      error: "SERVICE_UNAVAILABLE",
      message: "Câmbio Real temporariamente indisponível. Tente novamente em instantes.",
      http_status: lastStatus || 502,
      last_error: lastErr,
      fallback: true,
    });
  } catch (e) {
    return json({ error: (e as Error).message, fallback: true }, 200);
  }
});
