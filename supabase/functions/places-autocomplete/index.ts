// Proxy to Google Places API (New) Autocomplete via Lovable connector gateway.
// Avoids browser-key referrer restrictions — works on any domain (custom domains, PWA, mobile browser).
import { buildCorsHeaders } from "../_shared/cors.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const input = typeof body?.input === "string" ? body.input.trim() : "";
    const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken : undefined;

    if (input.length < 2) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAPS_API_KEY =
      Deno.env.get("GOOGLE_MAPS_API_KEY_1") ?? Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing connector credentials" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = {
      input,
      languageCode: "pt-BR",
      regionCode: "us",
      // Bias para Orlando/FL — não restringe, apenas prioriza
      locationBias: {
        circle: {
          center: { latitude: 28.5383, longitude: -81.3792 },
          radius: 150000.0,
        },
      },
      includedRegionCodes: ["us"],
    };
    if (sessionToken) payload.sessionToken = sessionToken;

    const r = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error("[places-autocomplete] upstream error", r.status, data);
      return new Response(
        JSON.stringify({ error: "places api error", status: r.status, data }),
        { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const suggestions = (data?.suggestions ?? [])
      .map((s: any) => {
        const p = s?.placePrediction;
        if (!p) return null;
        return {
          placeId: p.placeId,
          primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
          secondary: p.structuredFormat?.secondaryText?.text ?? "",
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[places-autocomplete] fatal", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
