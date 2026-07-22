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

const CONFIRMED = ["confirmed", "active", "in_progress", "completed"];

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
    if (!partnerId) return json(400, { ok: false, error: "partner_id required" });

    // Partner core
    const { data: partner, error: pErr } = await admin
      .from("partners")
      .select("id, agency_name, status, created_at, contact_name, contact_email, contact_phone")
      .eq("id", partnerId)
      .maybeSingle();
    if (pErr) return json(500, { ok: false, error: pErr.message });
    if (!partner) return json(404, { ok: false, error: "Partner not found" });

    // All bookings for KPIs + mission count
    const { data: allBookings, error: bErr } = await admin
      .from("bookings")
      .select("id, status, commission_amount, commission_payout_status")
      .eq("partner_id", partnerId)
      .is("deleted_at", null);
    if (bErr) return json(500, { ok: false, error: bErr.message });

    const bookings = allBookings ?? [];
    const totalBookings = bookings.length;
    const commissionPaid = bookings
      .filter((b) => b.commission_payout_status === "paid")
      .reduce((s, b) => s + Number(b.commission_amount ?? 0), 0);
    const commissionPending = bookings
      .filter((b) => b.commission_payout_status !== "paid")
      .reduce((s, b) => s + Number(b.commission_amount ?? 0), 0);
    const confirmedCount = bookings.filter((b) => CONFIRMED.includes(b.status as string)).length;

    // Recent bookings (top 10)
    const { data: recentBookings, error: rbErr } = await admin
      .from("bookings")
      .select(`
        id, booking_number, pickup_date, total_price,
        commission_amount, commission_payout_status, status,
        vehicles:vehicle_id ( name )
      `)
      .eq("partner_id", partnerId)
      .is("deleted_at", null)
      .order("pickup_date", { ascending: false })
      .limit(10);
    if (rbErr) return json(500, { ok: false, error: rbErr.message });

    // Recent proposals (top 10)
    const { data: recentProposals, error: rpErr } = await admin
      .from("partner_proposals")
      .select(`
        id, status, created_at, customer_name, total_price,
        vehicles:vehicle_id ( name )
      `)
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (rpErr) return json(500, { ok: false, error: rpErr.message });

    // Mission: next unawarded tier
    const { data: tiers } = await admin
      .from("partner_bonus_tiers")
      .select("id, threshold_bookings, bonus_amount, label, sort_order")
      .eq("is_active", true)
      .order("threshold_bookings", { ascending: true });
    const { data: awards } = await admin
      .from("partner_bonus_awards")
      .select("tier_id, payout_status")
      .eq("partner_id", partnerId);
    const awardedIds = new Set((awards ?? []).map((a) => a.tier_id as string));
    const tiersArr = (tiers ?? []) as Array<{ id: string; threshold_bookings: number; bonus_amount: number; label: string; sort_order: number }>;
    const nextTier =
      tiersArr.find((t) => !awardedIds.has(t.id) && t.threshold_bookings > confirmedCount) ||
      tiersArr.find((t) => !awardedIds.has(t.id)) ||
      null;
    const mission = nextTier
      ? {
          tier_id: nextTier.id,
          label: nextTier.label,
          bonus_amount: Number(nextTier.bonus_amount),
          threshold: nextTier.threshold_bookings,
          confirmed_count: confirmedCount,
          progress_pct: Math.min(100, (confirmedCount / Math.max(1, nextTier.threshold_bookings)) * 100),
          remaining: Math.max(0, nextTier.threshold_bookings - confirmedCount),
          all_done: false,
        }
      : { tier_id: null, label: null, bonus_amount: 0, threshold: 0, confirmed_count: confirmedCount, progress_pct: 100, remaining: 0, all_done: tiersArr.length > 0 };

    return json(200, {
      ok: true,
      partner,
      kpis: {
        total_bookings: totalBookings,
        commission_paid_usd: commissionPaid,
        commission_pending_usd: commissionPending,
        confirmed_count: confirmedCount,
      },
      recent_bookings: recentBookings ?? [],
      recent_proposals: recentProposals ?? [],
      mission,
    });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
