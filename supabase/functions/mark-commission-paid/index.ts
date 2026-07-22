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
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { ok: false, error: "Missing Authorization" });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { ok: false, error: "Invalid token" });
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const bookingId = body?.booking_id;
    const status = body?.status === "pending" ? "pending" : "paid";
    if (!bookingId || typeof bookingId !== "string") {
      return json(400, { ok: false, error: "booking_id required" });
    }

    // Get booking + its locadora
    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, locadora_id, partner_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (bErr) return json(500, { ok: false, error: bErr.message });
    if (!booking) return json(404, { ok: false, error: "Booking not found" });
    if (!booking.partner_id) {
      return json(400, { ok: false, error: "Booking has no partner_id" });
    }

    // Caller must be platform_admin OR admin/finance/operations of the booking's locadora
    const { data: roles, error: rErr } = await admin
      .from("user_roles")
      .select("role, locadora_id")
      .eq("user_id", callerId);
    if (rErr) return json(500, { ok: false, error: rErr.message });

    const isPlatformAdmin = (roles ?? []).some((r: any) => r.role === "platform_admin");
    const isStaffOfLocadora = (roles ?? []).some((r: any) =>
      ["admin", "finance", "operations"].includes(r.role) &&
      r.locadora_id === booking.locadora_id
    );

    if (!isPlatformAdmin && !isStaffOfLocadora) {
      return json(403, { ok: false, error: "Forbidden" });
    }

    const { error: uErr } = await admin
      .from("bookings")
      .update({ commission_payout_status: status })
      .eq("id", bookingId);
    if (uErr) return json(500, { ok: false, error: uErr.message });

    return json(200, { ok: true, booking_id: bookingId, commission_payout_status: status });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
