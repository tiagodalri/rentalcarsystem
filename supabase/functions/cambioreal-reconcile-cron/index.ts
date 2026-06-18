// B1 — Reconciliação Câmbio Real. Roda 5/5 min.
// Para cada payment_request AGUARDANDO_CLIENTE criado há > 5 min,
// consulta a API e aplica a mesma transição do webhook (idempotente).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_ID = Deno.env.get("CAMBIOREAL_APP_ID") || "1781587732";
const BASE_URL = Deno.env.get("CAMBIOREAL_BASE_URL") || "https://www.cambioreal.com";
const PENDING_STATUSES = ["AGUARDANDO_CLIENTE", "AGUARDANDO_PAGAMENTO", "PROCESSANDO"];
const TERMINAL_FAIL = ["BOLETO_EXPIRADO", "SOLICITACAO_CANCELADA", "SOLICITACAO_EXPIRADA", "CANCELADO", "EXPIRADO"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = (Deno.env.get("CAMBIOREAL_APP_SECRET") || "").trim();
  if (!secret) {
    return new Response(JSON.stringify({ error: "CAMBIOREAL_APP_SECRET not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const basic = btoa(`${APP_ID}:${secret}`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Pega pendentes criados há mais de 5 min (evita corrida com webhook recente)
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: pending, error: qErr } = await supabase
    .from("payment_requests")
    .select("id, cr_token, status, booking_id, created_at")
    .in("status", PENDING_STATUSES)
    .not("cr_token", "is", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50);

  if (qErr) {
    console.error("[reconcile] query error", qErr);
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ checked: 0, changed: 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let changed = 0;
  const results: Array<{ token: string; status: string; transitioned: boolean }> = [];

  for (const pr of pending) {
    try {
      const r = await fetch(`${BASE_URL}/service/v1/checkout/get/${pr.cr_token}`, {
        method: "GET",
        headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
      });
      const text = await r.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* noop */ }
      const data = parsed?.data ?? parsed;
      const status: string = data?.status ?? "UNKNOWN";
      const paymentMethod = data?.payment_method ?? null;
      const paid = status === "SOLICITACAO_PAGO";
      const failed = TERMINAL_FAIL.includes(status);

      // sync payment_request
      await supabase
        .from("payment_requests")
        .update({
          status,
          payment_method: paymentMethod,
          raw: parsed,
          paid_at: paid ? new Date().toISOString() : null,
        })
        .eq("id", pr.id);

      // transição idempotente do booking
      let transitioned = false;
      if (pr.booking_id && paid) {
        const { data: b } = await supabase
          .from("bookings")
          .select("status, contract_status")
          .eq("id", pr.booking_id)
          .maybeSingle();

        if (b && !["confirmed", "active", "in_progress", "completed"].includes(b.status)) {
          await supabase
            .from("bookings")
            .update({
              status: "confirmed",
              payment_status: "paid",
              paid_at: new Date().toISOString(),
              payment_method: paymentMethod ?? "cambioreal",
              hold_expires_at: null,
            })
            .eq("id", pr.booking_id);
          transitioned = true;

          // dispara contrato se ainda não foi
          const cs = b?.contract_status ?? "not_sent";
          if (["not_sent", "failed"].includes(cs)) {
            try {
              await supabase.functions.invoke("send-contract", { body: { booking_id: pr.booking_id } });
            } catch (e) {
              console.error("[reconcile] send-contract error", e);
            }
          }
        }
      } else if (pr.booking_id && failed) {
        const { data: b } = await supabase
          .from("bookings")
          .select("status")
          .eq("id", pr.booking_id)
          .maybeSingle();
        if (b && ["pending_payment", "pending"].includes(b.status)) {
          await supabase
            .from("bookings")
            .update({ status: "cancelled", hold_expires_at: null })
            .eq("id", pr.booking_id);
          transitioned = true;
        }
      }

      if (transitioned) changed++;
      results.push({ token: pr.cr_token!, status, transitioned });
    } catch (e) {
      console.error("[reconcile] item error", pr.id, e);
    }
  }

  console.log(`[reconcile] checked=${pending.length} changed=${changed}`);
  return new Response(JSON.stringify({ checked: pending.length, changed, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
