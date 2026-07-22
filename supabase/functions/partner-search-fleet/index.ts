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

const VEHICLE_COLS = [
  "id", "name", "category", "daily_price_usd", "image_url", "passengers", "bags",
  "transmission", "fuel", "year", "status", "features", "created_at", "updated_at",
  "color", "engine_type", "engine_size", "doors", "published", "photos", "brand",
  "model", "manufacture_year", "model_year", "deleted_at",
  "default_deposit_amount", "default_franchise_amount", "locadora_id",
].join(", ");

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
    const { pickup_date, return_date, category } = body ?? {};
    if (!pickup_date || !return_date || !/^\d{4}-\d{2}-\d{2}$/.test(pickup_date) || !/^\d{4}-\d{2}-\d{2}$/.test(return_date)) {
      return json(400, { ok: false, error: "pickup_date and return_date (YYYY-MM-DD) are required" });
    }

    // Fetch candidate vehicles across all active locadoras.
    let query = admin
      .from("vehicles")
      .select(VEHICLE_COLS)
      .eq("published", true)
      .is("deleted_at", null);
    if (category && typeof category === "string") {
      query = query.eq("category", category);
    }
    const { data: vehicles, error: vErr } = await query;
    if (vErr) return json(500, { ok: false, error: `vehicles: ${vErr.message}` });

    const locadoraIds = Array.from(new Set((vehicles ?? []).map((v: any) => v.locadora_id).filter(Boolean)));
    const { data: locadoras, error: lErr } = await admin
      .from("locadoras")
      .select("id, name, status")
      .in("id", locadoraIds.length ? locadoraIds : ["00000000-0000-0000-0000-000000000000"]);
    if (lErr) return json(500, { ok: false, error: `locadoras: ${lErr.message}` });
    const activeLocadoras = new Map<string, string>();
    for (const l of locadoras ?? []) {
      if ((l as any).status === "active") activeLocadoras.set((l as any).id, (l as any).name);
    }

    const results: any[] = [];
    for (const v of vehicles ?? []) {
      const locadoraName = activeLocadoras.get((v as any).locadora_id);
      if (!locadoraName) continue;

      const { data: available, error: aErr } = await admin.rpc("check_vehicle_availability", {
        p_vehicle_id: (v as any).id,
        p_pickup: pickup_date,
        p_return: return_date,
        p_exclude_id: null,
      });
      if (aErr || available !== true) continue;

      const { data: commission } = await admin.rpc("resolve_commission", {
        p_locadora_id: (v as any).locadora_id,
        p_vehicle_id: (v as any).id,
        p_partner_id: partnerId,
        p_at: new Date().toISOString(),
      });
      const c = Array.isArray(commission) ? commission[0] : commission;

      results.push({
        ...v,
        locadora_name: locadoraName,
        commission_type: c?.commission_type ?? null,
        commission_value: c?.commission_value ?? null,
      });
    }

    return json(200, { ok: true, results });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
