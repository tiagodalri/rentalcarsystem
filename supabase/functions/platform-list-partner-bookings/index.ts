import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { ok: false, error: "Missing Authorization" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { ok: false, error: "Invalid token" });

    const { data: isPlat, error: platErr } = await admin.rpc("is_platform_admin", { uid: userData.user.id });
    if (platErr) return json(500, { ok: false, error: platErr.message });
    if (!isPlat) return json(403, { ok: false, error: "Forbidden: platform_admin required" });

    const body = await req.json().catch(() => ({}));
    const partnerId = typeof body?.partner_id === "string" ? body.partner_id : null;
    const payoutStatus = body?.payout_status === "paid" || body?.payout_status === "pending" ? body.payout_status : null;
    const limit = Math.min(Math.max(Number(body?.limit ?? 200), 1), 500);
    const offset = Math.max(Number(body?.offset ?? 0), 0);

    let q = admin
      .from("bookings")
      .select(`
        id, booking_number, pickup_date, return_date, customer_name, total_price,
        commission_type, commission_value, commission_amount_usd, commission_payout_status, commission_paid_at,
        partner_id, vehicle_id, locadora_id,
        vehicles:vehicle_id ( name, category ),
        locadoras:locadora_id ( name ),
        partners:partner_id ( agency_name )
      `, { count: "exact" })
      .not("partner_id", "is", null)
      .is("deleted_at", null)
      .order("pickup_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (partnerId) q = q.eq("partner_id", partnerId);
    if (payoutStatus) q = q.eq("commission_payout_status", payoutStatus);

    const { data, error, count } = await q;
    if (error) return json(500, { ok: false, error: error.message });

    return json(200, { ok: true, rows: data ?? [], count: count ?? 0 });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
