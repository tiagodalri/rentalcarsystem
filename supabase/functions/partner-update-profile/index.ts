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

const ALLOWED = ["agency_name", "contact_name", "contact_email", "contact_phone", "notes"] as const;

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

    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("partner_id")
      .eq("user_id", callerId)
      .eq("role", "partner")
      .maybeSingle();
    if (roleErr) return json(500, { ok: false, error: roleErr.message });
    if (!roleRow?.partner_id) return json(403, { ok: false, error: "Forbidden: partner role required" });
    const partnerId = roleRow.partner_id as string;

    const body = await req.json().catch(() => ({}));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    for (const k of ALLOWED) {
      if (k in (body ?? {})) {
        const v = body[k];
        update[k] = typeof v === "string" ? v.trim() || null : v ?? null;
      }
    }
    if (!Object.keys(update).length) {
      return json(400, { ok: false, error: "No allowed fields provided" });
    }
    if ("agency_name" in update && (!update.agency_name || String(update.agency_name).length < 2)) {
      return json(400, { ok: false, error: "agency_name must be at least 2 chars" });
    }

    const { data, error } = await admin
      .from("partners")
      .update(update)
      .eq("id", partnerId)
      .select("id, agency_name, contact_name, contact_email, contact_phone, notes, status")
      .single();
    if (error) return json(500, { ok: false, error: error.message });

    return json(200, { ok: true, partner: data });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
