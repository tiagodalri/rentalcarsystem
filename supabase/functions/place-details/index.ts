// Proxy to Google Places API (New) via Lovable connector gateway
import { buildCorsHeaders } from "../_shared/cors.ts";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { placeId } = await req.json();
    if (!placeId || typeof placeId !== "string") {
      return new Response(JSON.stringify({ error: "placeId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing connector credentials" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fieldMask = [
      "id","displayName","formattedAddress","internationalPhoneNumber","nationalPhoneNumber",
      "websiteUri","googleMapsUri","rating","userRatingCount","priceLevel","types",
      "currentOpeningHours","regularOpeningHours","photos","editorialSummary","location",
    ].join(",");
    const r = await fetch(`${GATEWAY_URL}/places/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": fieldMask,
      },
    });
    const data = await r.json();
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "places api error", status: r.status, data }), {
        status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Build photo URL for the first photo (max 400px wide) via gateway media endpoint
    let photoUrl: string | null = null;
    const firstPhoto = data?.photos?.[0]?.name as string | undefined;
    if (firstPhoto) {
      const mediaResp = await fetch(
        `${GATEWAY_URL}/places/v1/${firstPhoto}/media?maxWidthPx=480&skipHttpRedirect=true`,
        {
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
          },
        }
      );
      if (mediaResp.ok) {
        const mediaJson = await mediaResp.json().catch(() => null);
        if (mediaJson?.photoUri) photoUrl = mediaJson.photoUri;
      }
    }
    return new Response(JSON.stringify({ place: data, photoUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
