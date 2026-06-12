import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_ID = "1781587732";
const ENDPOINT = "/service/v1/checkout/simulator";
const BASES = {
  production: "https://www.cambioreal.com",
  sandbox: "https://sandbox.cambioreal.com",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const rawSecret = Deno.env.get("CAMBIOREAL_APP_SECRET");
  if (!rawSecret) {
    return new Response(
      JSON.stringify({ error: "CAMBIOREAL_APP_SECRET not set" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const trimmed = rawSecret.trim();
  const secretDebug = {
    length_raw: rawSecret.length,
    length_trimmed: trimmed.length,
    has_whitespace_edges: rawSecret !== trimmed,
    first_3: trimmed.slice(0, 3),
    last_3: trimmed.slice(-3),
  };

  const basic = btoa(`${APP_ID}:${trimmed}`);
  const body = {
    amount: 300,
    currency: "USD",
    take_rates: 0,
    payment_method: "pix",
  };

  async function call(envName: string, baseUrl: string) {
    const url = `${baseUrl}${ENDPOINT}`;
    let http_status = 0;
    let raw_body = "";
    let parsed: unknown = null;
    let fetch_error: string | null = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basic}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(body),
      });
      http_status = res.status;
      raw_body = await res.text();
      try {
        parsed = JSON.parse(raw_body);
      } catch {
        parsed = null;
      }
    } catch (e) {
      fetch_error = (e as Error).message;
    }
    return { env: envName, url, http_status, raw_body, parsed_body: parsed, fetch_error };
  }

  const [production, sandbox] = await Promise.all([
    call("production", BASES.production),
    call("sandbox", BASES.sandbox),
  ]);

  return new Response(
    JSON.stringify(
      { app_id: APP_ID, secret_debug: secretDebug, request_body: body, production, sandbox },
      null,
      2,
    ),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
