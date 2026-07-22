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

    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("partner_id")
      .eq("user_id", callerId)
      .eq("role", "partner")
      .maybeSingle();
    if (roleErr) return json(500, { ok: false, error: roleErr.message });
    if (!roleRow?.partner_id) return json(403, { ok: false, error: "Forbidden: partner role required" });
    const partnerId = roleRow.partner_id as string;

    const { data: bookings, error: bErr } = await admin
      .from("bookings")
      .select("id, booking_number, pickup_date, return_date, total_price, commission_amount, commission_type, commission_value, commission_payout_status, status, locadora_id, vehicle_id, customer_name, created_at")
      .eq("partner_id", partnerId)
      .is("deleted_at", null)
      .order("pickup_date", { ascending: false })
      .limit(1000);
    if (bErr) return json(500, { ok: false, error: bErr.message });

    const list = bookings ?? [];
    const vIds = Array.from(new Set(list.map((b) => b.vehicle_id).filter(Boolean))) as string[];
    const lIds = Array.from(new Set(list.map((b) => b.locadora_id).filter(Boolean))) as string[];

    const [vRes, lRes] = await Promise.all([
      vIds.length
        ? admin.from("vehicles").select("id, name, category, brand, model").in("id", vIds)
        : Promise.resolve({ data: [], error: null }),
      lIds.length
        ? admin.from("locadoras").select("id, name").in("id", lIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (vRes.error) return json(500, { ok: false, error: `vehicles: ${vRes.error.message}` });
    if (lRes.error) return json(500, { ok: false, error: `locadoras: ${lRes.error.message}` });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vMap = new Map((vRes.data ?? []).map((v: any) => [v.id, v]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lMap = new Map((lRes.data ?? []).map((l: any) => [l.id, l]));

    const results = list.map((b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v: any = b.vehicle_id ? vMap.get(b.vehicle_id) : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const l: any = b.locadora_id ? lMap.get(b.locadora_id) : null;
      return {
        ...b,
        vehicle_name: v?.name ?? null,
        vehicle_category: v?.category ?? null,
        locadora_name: l?.name ?? null,
      };
    });

    return json(200, { ok: true, results });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
