import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { buildCorsHeaders } from "../_shared/cors.ts";
const APP_ID = Deno.env.get("CAMBIOREAL_APP_ID") || "1781587732";
const BASE_URL = Deno.env.get("CAMBIOREAL_BASE_URL") || "https://www.cambioreal.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const secret = (Deno.env.get("CAMBIOREAL_APP_SECRET") || "").trim();
    if (!secret) return json({ error: "CAMBIOREAL_APP_SECRET not set" }, 500);

    const body = await req.json();
    const {
      vehicle_id,
      start_at, // ISO date or datetime
      end_at,
      amount_usd,
      client,
      site_origin, // optional override for callback URLs
    } = body || {};

    if (!vehicle_id || !start_at || !end_at || !amount_usd || !client?.name || !client?.email) {
      return json({ error: "Missing required fields: vehicle_id, start_at, end_at, amount_usd, client{name,email}" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Normalize dates: bookings.pickup_date / return_date are DATE
    const pickupDate = String(start_at).slice(0, 10);
    const returnDate = String(end_at).slice(0, 10);
    const pickupTime = String(start_at).includes("T") ? String(start_at).slice(11, 16) : "10:00";
    const returnTime = String(end_at).includes("T") ? String(end_at).slice(11, 16) : "10:00";

    // 1) availability check — blocks against confirmed/active + non-expired pending_payment holds
    const nowIso = new Date().toISOString();
    const { data: overlapping, error: overlapErr } = await supabase
      .from("bookings")
      .select("id, status, hold_expires_at, pickup_date, return_date")
      .eq("vehicle_id", vehicle_id)
      .is("deleted_at", null)
      .lt("pickup_date", returnDate)
      .gt("return_date", pickupDate);

    if (overlapErr) return json({ error: overlapErr.message }, 500);

    const blocking = (overlapping || []).filter((b: any) => {
      if (["pending", "confirmed", "active", "in_progress"].includes(b.status)) return true;
      if (b.status === "pending_payment" && b.hold_expires_at && b.hold_expires_at > nowIso) return true;
      return false;
    });
    if (blocking.length > 0) return json({ error: "Carro indisponível" }, 409);

    // 2) vehicle for description
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("id, brand, model, year")
      .eq("id", vehicle_id)
      .maybeSingle();

    const vehicleName = vehicle
      ? `${vehicle.brand} ${vehicle.model}${vehicle.year ? " " + vehicle.year : ""}`
      : "Veículo";

    // 3) reuse or create customer
    let customerId: string | null = null;
    if (client.email) {
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("email", client.email)
        .maybeSingle();
      if (existing?.id) {
        customerId = existing.id;
      } else {
        const { data: created, error: custErr } = await supabase
          .from("customers")
          .insert({
            full_name: client.name,
            email: client.email,
            phone: client.phone ?? null,
            document_number: client.cpf ?? null,
            date_of_birth: client.birth ?? null,
            source: "regular",
          })
          .select("id")
          .single();
        if (custErr) return json({ error: "Customer create failed: " + custErr.message }, 500);
        customerId = created.id;
      }
    }

    // 4) create booking (draft, pending_payment, 30-min hold)
    const holdExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { data: booking, error: bookErr } = await supabase
      .from("bookings")
      .insert({
        customer_id: customerId,
        customer_name: client.name,
        customer_email: client.email,
        customer_phone: client.phone ?? null,
        vehicle_id,
        pickup_date: pickupDate,
        return_date: returnDate,
        pickup_time: pickupTime,
        return_time: returnTime,
        status: "pending_payment",
        total_price: amount_usd,
        payment_status: "pending",
        hold_expires_at: holdExpires,
        addons: { currency: "USD", source: "site", payment_gateway: "cambioreal" },
      })
      .select("id, booking_number")
      .single();
    if (bookErr) return json({ error: "Booking create failed: " + bookErr.message }, 500);

    const orderId = `RENTAL STUDIO-${booking.id}`;
    const origin = site_origin || req.headers.get("origin") || "https://rentalcarsystem.lovable.app";

    const payload = {
      order_id: orderId,
      amount: amount_usd,
      currency: "USD",
      take_rates: 0,
      due_date: 1,
      url_callback: `${origin}/checkout/retorno?order=${encodeURIComponent(orderId)}`,
      url_error: `${origin}/checkout/erro?order=${encodeURIComponent(orderId)}`,
      client: {
        name: client.name,
        email: client.email,
        cpf: client.cpf ?? "",
        phone: client.phone ?? "",
        birth: client.birth ?? "",
        address: client.address ?? "",
      },
      products: [
        {
          descricao: `Aluguel ${vehicleName} ${pickupDate} a ${returnDate}`,
          base_value: amount_usd,
          valor: amount_usd,
          qty: 1,
          ref: orderId,
          category: "Car Rental",
          brand: "Sua Marca",
          sku: vehicle_id,
        },
      ],
    };

    const basic = btoa(`${APP_ID}:${secret}`);
    const crRes = await fetch(`${BASE_URL}/service/v1/checkout/request`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const crText = await crRes.text();
    let crJson: any = null;
    try { crJson = JSON.parse(crText); } catch { /* leave null */ }

    if (!crRes.ok || crJson?.status === "error") {
      // rollback booking
      await supabase.from("bookings").delete().eq("id", booking.id);
      return json({
        error: "Câmbio Real recusou o checkout",
        http_status: crRes.status,
        cr_response: crJson ?? crText,
      }, 502);
    }

    const data = crJson?.data ?? crJson;
    const { error: prErr } = await supabase.from("payment_requests").insert({
      booking_id: booking.id,
      order_id: orderId,
      cr_id: data?.id ?? null,
      cr_token: data?.token ?? null,
      cr_code: data?.code ?? null,
      amount_usd,
      status: "AGUARDANDO_CLIENTE",
      checkout_url: data?.checkout ?? null,
      raw: crJson,
    });
    if (prErr) console.warn("payment_requests insert failed:", prErr.message);

    return json({
      checkout_url: data?.checkout,
      order_id: orderId,
      booking_id: booking.id,
      booking_number: booking.booking_number,
      hold_expires_at: holdExpires,
    });
  } catch (e) {
    console.error("create-checkout error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
