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
    const callerId = userData.user.id;

    const { data: isPlat, error: platErr } = await admin.rpc("is_platform_admin", { uid: callerId });
    if (platErr) return json(500, { ok: false, error: platErr.message });
    if (!isPlat) return json(403, { ok: false, error: "Forbidden: platform_admin required" });

    const body = await req.json().catch(() => ({}));
    const { partner_id } = body ?? {};
    if (!partner_id) return json(400, { ok: false, error: "partner_id required" });

    const { data: roles, error: rErr } = await admin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "partner")
      .eq("partner_id", partner_id);
    if (rErr) return json(500, { ok: false, error: rErr.message });

    const roleUserIds = new Set((roles ?? []).map((r) => r.user_id));
    const { data: list, error: lErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (lErr) return json(500, { ok: false, error: lErr.message });

    const users = (list?.users ?? [])
      .filter((u) => roleUserIds.has(u.id))
      .map((u) => ({
        user_id: u.id,
        email: u.email ?? null,
        full_name: (u.user_metadata as Record<string, unknown>)?.full_name ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      }));

    return json(200, { ok: true, users });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
