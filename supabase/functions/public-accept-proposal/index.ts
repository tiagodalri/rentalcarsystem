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

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token || token.length < 12 || token.length > 80 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return json(400, { error: "invalid_token" });
    }

    const { data: p, error } = await admin
      .from("partner_proposals")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (error) return json(500, { error: "internal_error" });
    if (!p) return json(404, { error: "not_found" });
    if (p.status === "cancelled") return json(410, { error: "cancelled" });
    if (p.status === "accepted") return json(409, { error: "already_accepted" });
    if (new Date(p.expires_at).getTime() < Date.now()) return json(410, { error: "expired" });

    // Recheck availability
    const { data: available, error: aErr } = await admin.rpc("check_vehicle_availability", {
      p_vehicle_id: p.vehicle_id,
      p_pickup: p.pickup_date,
      p_return: p.return_date,
      p_exclude_id: null,
    });
    if (aErr) return json(500, { error: `availability: ${aErr.message}` });
    if (available !== true) return json(409, { error: "not_available" });

    // Insert booking using commission snapshot from the proposal (do NOT recompute)
    const { data: inserted, error: iErr } = await admin
      .from("bookings")
      .insert({
        vehicle_id: p.vehicle_id,
        customer_name: p.customer_name,
        customer_email: p.customer_email,
        customer_phone: p.customer_phone,
        pickup_date: p.pickup_date,
        return_date: p.return_date,
        pickup_time: p.pickup_time,
        return_time: p.return_time,
        pickup_location: p.pickup_location,
        return_location: p.return_location,
        total_price: p.total_price,
        status: "confirmed",
        payment_status: "collected_externally",
        locadora_id: p.locadora_id,
        partner_id: p.partner_id,
        commission_type: p.commission_type,
        commission_value: p.commission_value,
        commission_amount: p.commission_amount,
        commission_locked_at: new Date().toISOString(),
        notes: p.message ? `Proposta aceita pelo cliente. Nota: ${p.message}` : "Proposta aceita pelo cliente",
      })
      .select("id, booking_number")
      .single();
    if (iErr) return json(500, { error: `insert: ${iErr.message}` });

    await admin
      .from("partner_proposals")
      .update({ status: "accepted", accepted_booking_id: inserted.id })
      .eq("id", p.id);

    return json(200, {
      ok: true,
      booking_number: inserted.booking_number,
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "internal_error" });
  }
});
