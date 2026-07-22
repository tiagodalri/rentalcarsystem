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

function randomToken(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let b64 = btoa(String.fromCharCode(...buf));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("partner_id")
      .eq("user_id", userData.user.id)
      .eq("role", "partner")
      .maybeSingle();
    if (!roleRow?.partner_id) return json(403, { ok: false, error: "Forbidden: partner role required" });
    const partnerId = roleRow.partner_id as string;

    const body = await req.json().catch(() => ({}));
    const {
      vehicle_id,
      pickup_date, return_date,
      pickup_time, return_time,
      pickup_location, return_location,
      customer_name, customer_email, customer_phone,
      message,
    } = body ?? {};

    if (!vehicle_id || typeof vehicle_id !== "string") return json(400, { ok: false, error: "vehicle_id required" });
    if (!customer_name || typeof customer_name !== "string" || customer_name.trim().length < 2) {
      return json(400, { ok: false, error: "customer_name required" });
    }
    if (!pickup_date || !return_date
      || !/^\d{4}-\d{2}-\d{2}$/.test(pickup_date)
      || !/^\d{4}-\d{2}-\d{2}$/.test(return_date)) {
      return json(400, { ok: false, error: "pickup_date and return_date (YYYY-MM-DD) required" });
    }
    if (return_date <= pickup_date) return json(400, { ok: false, error: "return_date must be after pickup_date" });

    const { data: vehicle, error: vErr } = await admin
      .from("vehicles")
      .select("id, locadora_id, published, deleted_at")
      .eq("id", vehicle_id)
      .maybeSingle();
    if (vErr) return json(500, { ok: false, error: `vehicle: ${vErr.message}` });
    if (!vehicle || vehicle.deleted_at || (vehicle as any).published !== true) {
      return json(404, { ok: false, error: "Vehicle not available" });
    }
    const locadoraId = (vehicle as any).locadora_id as string | null;
    if (!locadoraId) return json(409, { ok: false, error: "Vehicle has no locadora assigned" });

    // Price snapshot
    const { data: pricingRaw, error: pErr } = await admin.rpc("get_vehicle_pricing", {
      p_vehicle_id: vehicle_id,
      p_pickup: pickup_date,
      p_return: return_date,
    });
    if (pErr) return json(500, { ok: false, error: `pricing: ${pErr.message}` });
    const pricing = Array.isArray(pricingRaw) ? pricingRaw[0] : pricingRaw;
    const totalPrice = Number(pricing?.subtotal_rental ?? 0);
    if (!(totalPrice > 0)) return json(500, { ok: false, error: "Failed to compute price" });

    // Commission snapshot
    const { data: commissionRaw } = await admin.rpc("resolve_commission", {
      p_locadora_id: locadoraId,
      p_vehicle_id: vehicle_id,
      p_partner_id: partnerId,
      p_at: new Date().toISOString(),
    });
    const c = Array.isArray(commissionRaw) ? commissionRaw[0] : commissionRaw;
    const commissionType = (c?.commission_type ?? null) as "percent" | "fixed" | null;
    const commissionValue = c?.commission_value != null ? Number(c.commission_value) : null;
    let commissionAmount: number | null = null;
    if (commissionType === "percent" && commissionValue != null) {
      commissionAmount = Number((totalPrice * commissionValue / 100).toFixed(2));
    } else if (commissionType === "fixed" && commissionValue != null) {
      commissionAmount = Number(commissionValue.toFixed(2));
    }

    // Generate unique token
    let proposalToken = randomToken(24);
    for (let i = 0; i < 3; i++) {
      const { data: existing } = await admin
        .from("partner_proposals")
        .select("id")
        .eq("token", proposalToken)
        .maybeSingle();
      if (!existing) break;
      proposalToken = randomToken(24);
    }

    const { data: inserted, error: iErr } = await admin
      .from("partner_proposals")
      .insert({
        partner_id: partnerId,
        vehicle_id,
        locadora_id: locadoraId,
        pickup_date, return_date,
        pickup_time: pickup_time ?? null,
        return_time: return_time ?? null,
        pickup_location: pickup_location ?? null,
        return_location: return_location ?? null,
        customer_name: customer_name.trim(),
        customer_email: customer_email ?? null,
        customer_phone: customer_phone ?? null,
        message: message ?? null,
        total_price: totalPrice,
        commission_type: commissionType,
        commission_value: commissionValue,
        commission_amount: commissionAmount,
        token: proposalToken,
      })
      .select("id, token, expires_at")
      .single();
    if (iErr) return json(500, { ok: false, error: `insert: ${iErr.message}` });

    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const cleanOrigin = origin.replace(/\/$/, "");
    const shareUrl = `${cleanOrigin}/proposta/${inserted.token}`;

    return json(200, {
      ok: true,
      token: inserted.token,
      share_url: shareUrl,
      expires_at: inserted.expires_at,
      total_price: totalPrice,
      commission_amount: commissionAmount,
    });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
