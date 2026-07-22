import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim();
    if (!token || token.length < 12 || token.length > 80 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return json(400, { error: "invalid_token" });
    }

    const { data: p, error } = await admin
      .from("partner_proposals")
      .select("id, vehicle_id, locadora_id, partner_id, pickup_date, return_date, pickup_time, return_time, pickup_location, return_location, customer_name, message, total_price, status, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (error) return json(500, { error: "internal_error" });
    if (!p) return json(404, { error: "not_found" });
    if (p.status === "cancelled") return json(410, { error: "cancelled" });
    if (p.status === "accepted") return json(200, { status: "accepted" });
    if (new Date(p.expires_at).getTime() < Date.now()) return json(410, { error: "expired" });

    const [{ data: vehicle }, { data: locadora }, { data: partner }] = await Promise.all([
      admin.from("vehicles").select("name, category, image_url, photos").eq("id", p.vehicle_id).maybeSingle(),
      admin.from("locadoras").select("name").eq("id", p.locadora_id).maybeSingle(),
      admin.from("partners").select("agency_name").eq("id", p.partner_id).maybeSingle(),
    ]);

    return json(200, {
      status: p.status,
      expires_at: p.expires_at,
      customer_name: p.customer_name,
      message: p.message,
      pickup_date: p.pickup_date,
      return_date: p.return_date,
      pickup_time: p.pickup_time,
      return_time: p.return_time,
      pickup_location: p.pickup_location,
      return_location: p.return_location,
      total_price: p.total_price,
      vehicle: vehicle ? {
        name: (vehicle as any).name,
        category: (vehicle as any).category,
        image_url: (vehicle as any).image_url,
        photos: (vehicle as any).photos,
      } : null,
      locadora_name: (locadora as any)?.name ?? null,
      agency_name: (partner as any)?.agency_name ?? null,
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "internal_error" });
  }
});
