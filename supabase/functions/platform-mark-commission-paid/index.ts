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
    const bookingId = body?.booking_id;
    const status = body?.status === "pending" ? "pending" : "paid";
    if (!bookingId || typeof bookingId !== "string") {
      return json(400, { ok: false, error: "booking_id required" });
    }

    const patch = status === "paid"
      ? { commission_payout_status: "paid", commission_paid_at: new Date().toISOString() }
      : { commission_payout_status: "pending", commission_paid_at: null };

    const { data, error } = await admin
      .from("bookings")
      .update(patch)
      .eq("id", bookingId)
      .select("id, commission_payout_status, commission_paid_at")
      .maybeSingle();
    if (error) return json(500, { ok: false, error: error.message });
    if (!data) return json(404, { ok: false, error: "Booking not found" });

    return json(200, { ok: true, booking: data });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
