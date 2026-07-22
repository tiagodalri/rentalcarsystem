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

    const nowIso = new Date().toISOString();
    const monthAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Active partners
    const { count: activePartners } = await admin
      .from("partners")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    // Bookings with partner
    const { data: bookingsAll, error: bErr } = await admin
      .from("bookings")
      .select("id, partner_id, total_price, commission_amount_usd, commission_payout_status, commission_paid_at, created_at")
      .not("partner_id", "is", null)
      .is("deleted_at", null);
    if (bErr) return json(500, { ok: false, error: bErr.message });

    const bookings = bookingsAll ?? [];
    const totalBookings = bookings.length;
    const bookingsLastMonth = bookings.filter((b) => (b.created_at ?? "") >= monthAgoIso).length;
    const revenue = bookings.reduce((s, b) => s + Number(b.total_price ?? 0), 0);
    const commissionPaid = bookings
      .filter((b) => b.commission_payout_status === "paid")
      .reduce((s, b) => s + Number(b.commission_amount_usd ?? 0), 0);
    const commissionPending = bookings
      .filter((b) => b.commission_payout_status !== "paid")
      .reduce((s, b) => s + Number(b.commission_amount_usd ?? 0), 0);

    // Top 5 by commission (paid + pending)
    const byPartner = new Map<string, { partner_id: string; bookings: number; commission: number }>();
    for (const b of bookings) {
      const pid = b.partner_id as string;
      const cur = byPartner.get(pid) ?? { partner_id: pid, bookings: 0, commission: 0 };
      cur.bookings += 1;
      cur.commission += Number(b.commission_amount_usd ?? 0);
      byPartner.set(pid, cur);
    }
    const topArr = [...byPartner.values()].sort((a, b) => b.commission - a.commission).slice(0, 5);
    let topPartners: Array<{ partner_id: string; agency_name: string | null; bookings: number; commission: number }> = [];
    if (topArr.length > 0) {
      const ids = topArr.map((t) => t.partner_id);
      const { data: pnames } = await admin.from("partners").select("id, agency_name").in("id", ids);
      const nameMap = new Map((pnames ?? []).map((p) => [p.id, p.agency_name as string | null]));
      topPartners = topArr.map((t) => ({ ...t, agency_name: nameMap.get(t.partner_id) ?? null }));
    }

    // Proposals
    const { data: proposalsAll, error: pErr } = await admin
      .from("partner_proposals")
      .select("id, status");
    if (pErr) return json(500, { ok: false, error: pErr.message });
    const proposals = proposalsAll ?? [];
    const propTotal = proposals.length;
    const propAccepted = proposals.filter((p) => p.status === "accepted").length;
    const conversion = propTotal > 0 ? (propAccepted / propTotal) * 100 : 0;

    return json(200, {
      ok: true,
      overview: {
        active_partners: activePartners ?? 0,
        total_bookings: totalBookings,
        bookings_last_month: bookingsLastMonth,
        revenue_usd: revenue,
        commission_paid_usd: commissionPaid,
        commission_pending_usd: commissionPending,
        proposals_sent: propTotal,
        proposals_accepted: propAccepted,
        conversion_pct: conversion,
        top_partners: topPartners,
        generated_at: nowIso,
      },
    });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
