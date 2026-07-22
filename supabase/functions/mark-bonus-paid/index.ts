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
    const awardId = body?.award_id;
    const status = body?.status === "pending" ? "pending" : "paid";
    if (!awardId || typeof awardId !== "string") {
      return json(400, { ok: false, error: "award_id required" });
    }

    // Caller must be platform_admin
    const { data: roles, error: rErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    if (rErr) return json(500, { ok: false, error: rErr.message });

    const isPlatformAdmin = (roles ?? []).some((r: { role: string }) => r.role === "platform_admin");
    if (!isPlatformAdmin) return json(403, { ok: false, error: "Forbidden — platform admin only" });

    const patch = status === "paid"
      ? { payout_status: "paid", paid_at: new Date().toISOString() }
      : { payout_status: "pending", paid_at: null };

    const { error: uErr } = await admin
      .from("partner_bonus_awards")
      .update(patch)
      .eq("id", awardId);
    if (uErr) return json(500, { ok: false, error: uErr.message });

    return json(200, { ok: true, award_id: awardId, payout_status: status });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
