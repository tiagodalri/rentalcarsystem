// Câmbio Real v2 (transparente) — Cartão de crédito
// O cartão é tokenizado no NAVEGADOR via card-hash.js. Aqui só chega
// { bin, brand, dfp_id, holder, token } + installments. Nunca o PAN.
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
      start_at,
      end_at,
      amount_usd,
      installments,
      client,
      card,
    } = body || {};

    const instN = Number(installments || 1);
    if (
      !vehicle_id || !start_at || !end_at || !amount_usd ||
      !client?.name || !client?.email || !client?.cpf ||
      !card?.token || !card?.bin || !card?.brand || !card?.holder || !card?.dfp_id ||
      !Number.isFinite(instN) || instN < 1 || instN > 12
    ) {
      return json(
        {
          error:
            "Missing/invalid fields. Required: vehicle_id, start_at, end_at, amount_usd, installments(1..12), client{name,email,cpf}, card{bin,brand,dfp_id,holder,token}",
        },
        400,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const pickupDate = String(start_at).slice(0, 10);
    const returnDate = String(end_at).slice(0, 10);
    const pickupTime = String(start_at).includes("T") ? String(start_at).slice(11, 16) : "10:00";
    const returnTime = String(end_at).includes("T") ? String(end_at).slice(11, 16) : "10:00";

    // availability
    const nowIso = new Date().toISOString();
    const { data: overlapping, error: overlapErr } = await supabase
      .from("bookings")
      .select("id, status, hold_expires_at")
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

    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("id, brand, model, year")
      .eq("id", vehicle_id)
      .maybeSingle();
    const vehicleName = vehicle
      ? `${vehicle.brand} ${vehicle.model}${vehicle.year ? " " + vehicle.year : ""}`
      : "Veículo";

    // customer
    let customerId: string | null = null;
    const { data: existing } = await supabase
      .from("customers")
      .select("id").eq("email", client.email).maybeSingle();
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
          date_of_birth: client.birth_date ?? null,
          source: "regular",
        })
        .select("id").single();
      if (custErr) return json({ error: "Customer create failed: " + custErr.message }, 500);
      customerId = created.id;
    }

    // booking (hold)
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
        addons: {
          currency: "USD",
          source: "site",
          payment_gateway: "cambioreal",
          payment_method: "credit_card",
          installments: instN,
        },
      })
      .select("id, booking_number")
      .single();
    if (bookErr) return json({ error: "Booking create failed: " + bookErr.message }, 500);

    const orderId = `GODRIVE-${booking.id}`;

    function isEmailConflict(j: any, status: number): boolean {
      const errs = j?.errors ?? [];
      const blob = JSON.stringify(j || "").toLowerCase();
      if (status === 409) return true;
      if (Array.isArray(errs) && errs.some((e: any) =>
        /email|e-?mail/i.test(JSON.stringify(e)) &&
        /(exist|already|cadastrad|uso|duplic|registered)/i.test(JSON.stringify(e))
      )) return true;
      return /email[^a-z]*(j[áa]|already|exist|duplic|cadastrad|in use|registered)/i.test(blob);
    }

    function buildPayload(emailOverride?: string) {
      return {
        order_id: orderId,
        amount: amount_usd,
        currency: "USD",
        take_rates: 0,
        payment_method: "credit_card",
        client: {
          name: client.name,
          email: emailOverride ?? client.email,
          document: client.cpf,
          birth_date: client.birth_date ?? "",
          phone: client.phone ?? "",
          ip: client.ip ?? (req.headers.get("x-forwarded-for") || "").split(",")[0].trim(),
          address: client.address ?? undefined,
        },
        products: [
          {
            descricao: `Aluguel ${vehicleName} ${pickupDate} a ${returnDate}`,
            base_value: amount_usd,
            valor: amount_usd,
            qty: 1,
            ref: orderId,
            category: "Car Rental",
            brand: "GoDrive",
            sku: vehicle_id,
          },
        ],
        card: {
          bin: card.bin,
          brand: card.brand,
          country: "BR",
          dfp_id: card.dfp_id,
          holder: card.holder,
          installments: instN,
          token: card.token,
          type: "credit",
        },
      };
    }

    const basic = btoa(`${APP_ID}:${secret}`);

    async function callCr(payload: any) {
      const r = await fetch(`${BASE_URL}/service/v2/checkout/request`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* keep null */ }
      return { res: r, json: parsed, text };
    }

    let { res: crRes, json: crJson, text: crText } = await callCr(buildPayload());
    let aliasUsed: string | null = null;

    if ((!crRes.ok || crJson?.status === "error") && isEmailConflict(crJson, crRes.status)) {
      const [local, domain] = String(client.email).split("@");
      if (local && domain) {
        const alias = `${local}+zeus${booking.id.replace(/-/g, "").slice(0, 8)}@${domain}`;
        aliasUsed = alias;
        const retry = await callCr(buildPayload(alias));
        crRes = retry.res; crJson = retry.json; crText = retry.text;
      }
    }

    if (!crRes.ok || crJson?.status === "error") {
      await supabase.from("bookings").delete().eq("id", booking.id);
      return json(
        {
          error: crJson?.message || crJson?.errors?.[0]?.message || "Câmbio Real recusou o cartão",
          errors: crJson?.errors ?? null,
          http_status: crRes.status,
          cr_response: crJson ?? crText,
        },
        200,
      );
    }

    const data = crJson?.data ?? crJson;
    const tx = data?.transaction ?? {};
    const crStatus: string = data?.status ?? tx?.status ?? "AGUARDANDO_CLIENTE";
    const approved = crStatus === "SOLICITACAO_PAGO";

    await supabase.from("payment_requests").insert({
      booking_id: booking.id,
      order_id: orderId,
      cr_id: data?.id ?? null,
      cr_token: data?.token ?? null,
      cr_code: tx?.code ?? data?.code ?? null,
      amount_usd,
      status: crStatus,
      payment_method: "credit_card",
      checkout_url: tx?.ticket_url ?? null,
      paid_at: approved ? new Date().toISOString() : null,
      raw: { ...crJson, _zeus_alias_used: aliasUsed, _zeus_real_email: client.email },
    });

    // NÃO confirmamos a booking aqui — o webhook é a fonte da verdade.
    // Apenas devolvemos o veredito pra UI mostrar.
    return json({
      booking_id: booking.id,
      booking_number: booking.booking_number,
      approved,
      status: crStatus,
      message: approved ? "Pagamento aprovado" : (data?.message || tx?.message || "Aguardando confirmação"),
      cr_token: data?.token ?? null,
    });
  } catch (e) {
    console.error("cambioreal-pay-card error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
