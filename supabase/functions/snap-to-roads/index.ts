// Snap a path of GPS fixes to the nearest road segments using the Google
// Roads API via the Lovable connector gateway. Returns interpolated points
// so the resulting polyline follows the actual road geometry (no more
// "cutting through buildings" between sparse fixes).
import { buildCorsHeaders } from "../_shared/cors.ts";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const MAX_POINTS_PER_CALL = 100; // Roads API hard limit

type Pt = { lat: number; lng: number };

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const path = body?.path as Pt[] | undefined;
    const interpolate = body?.interpolate !== false; // default true
    if (!Array.isArray(path) || path.length < 2) {
      return new Response(JSON.stringify({ snapped: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing connector credentials" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chunk by 100 to respect API limits. Overlap by 1 so segments join cleanly.
    const chunks: Pt[][] = [];
    for (let i = 0; i < path.length; i += MAX_POINTS_PER_CALL - 1) {
      chunks.push(path.slice(i, i + MAX_POINTS_PER_CALL));
      if (i + MAX_POINTS_PER_CALL >= path.length) break;
    }

    const snapped: { lat: number; lng: number; originalIndex: number | null }[] = [];
    let chunkOffset = 0;

    for (const chunk of chunks) {
      const pathParam = chunk.map((p) => `${p.lat},${p.lng}`).join("|");
      const url = `${GATEWAY_URL}/roads/v1/snapToRoads?interpolate=${interpolate}&path=${encodeURIComponent(pathParam)}`;
      const r = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        },
      });
      if (!r.ok) {
        const txt = await r.text();
        console.error("[snap-to-roads]", r.status, txt);
        // Fallback: pass-through chunk as-is so the line still draws.
        for (let i = 0; i < chunk.length; i++) {
          snapped.push({ lat: chunk[i].lat, lng: chunk[i].lng, originalIndex: chunkOffset + i });
        }
      } else {
        const data = await r.json();
        const pts = (data?.snappedPoints ?? []) as Array<{
          location: { latitude: number; longitude: number };
          originalIndex?: number;
        }>;
        for (const sp of pts) {
          snapped.push({
            lat: sp.location.latitude,
            lng: sp.location.longitude,
            originalIndex: sp.originalIndex != null ? chunkOffset + sp.originalIndex : null,
          });
        }
      }
      chunkOffset += chunk.length - 1; // overlap of 1
    }

    return new Response(JSON.stringify({ snapped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[snap-to-roads] fatal", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
