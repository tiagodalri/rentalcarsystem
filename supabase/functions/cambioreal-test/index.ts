import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_ID = "1781587732";
const BASE_URL = "https://sandbox.cambioreal.com";
const ENDPOINT = "/service/v1/checkout/simulator";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const appSecret = Deno.env.get("CAMBIOREAL_APP_SECRET");
  if (!appSecret) {
    return new Response(
      JSON.stringify({ error: "CAMBIOREAL_APP_SECRET not set" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const basic = btoa(`${APP_ID}:${appSecret}`);
  const url = `${BASE_URL}${ENDPOINT}`;

  async function callSimulator(payment_method: "pix" | "credit_card") {
    const body = {
      amount: 300,
      currency: "USD",
      take_rates: 0,
      payment_method,
    };
    let status = 0;
    let rawBody = "";
    let parsed: unknown = null;
    let errorMessage: string | null = null;
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
      status = res.status;
      rawBody = await res.text();
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        parsed = null;
      }
    } catch (e) {
      errorMessage = (e as Error).message;
    }
    return {
      request: { url, method: "POST", body },
      http_status: status,
      raw_body: rawBody,
      parsed_body: parsed,
      fetch_error: errorMessage,
    };
  }

  const [pix, credit_card] = await Promise.all([
    callSimulator("pix"),
    callSimulator("credit_card"),
  ]);

  return new Response(
    JSON.stringify({ app_id: APP_ID, base_url: BASE_URL, pix, credit_card }, null, 2),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
