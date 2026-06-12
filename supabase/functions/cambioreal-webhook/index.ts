import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_ID = Deno.env.get("CAMBIOREAL_APP_ID") || "1781587732";
const BASE_URL = Deno.env.get("CAMBIOREAL_BASE_URL") || "https://www.cambioreal.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Always 200 to the gateway, process in background.
  const ack = new Response("ok", { status: 200, headers: corsHeaders });

  let id: string | null = null;
  let token: string | null = null;

  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const b = await req.json();
      id = b?.id?.toString() ?? null;
      token = b?.token ?? null;
    } else {
      const form = await req.formData();
      id = form.get("id")?.toString() ?? null;
      token = form.get("token")?.toString() ?? null;
    }
  } catch (e) {
    console.warn("webhook parse error", e);
    return ack;
  }

  if (!token) {
    console.warn("webhook without token", { id });
    return ack;
  }

  // Background processing — don't block the 200.
  (async () => {
    try {
      const secret = (Deno.env.get("CAMBIOREAL_APP_SECRET") || "").trim();
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const basic = btoa(`${APP_ID}:${secret}`);
      const r = await fetch(`${BASE_URL}/service/v1/checkout/get/${token}`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${basic}`,
          Accept: "application/json",
        },
      });
      const text = await r.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* keep null */ }
      const data = parsed?.data ?? parsed;
      const status = (data?.status as string) || "UNKNOWN";
      const paymentMethod = data?.payment_method ?? null;

      const { data: pr } = await supabase
        .from("payment_requests")
        .select("id, booking_id, status")
        .eq("cr_token", token)
        .maybeSingle();

      if (!pr) {
        console.warn("payment_request not found for token", token);
        return;
      }

      // Update payment_request
      await supabase
        .from("payment_requests")
        .update({
          status,
          payment_method: paymentMethod,
          raw: parsed,
          paid_at: status === "SOLICITACAO_PAGO" ? new Date().toISOString() : null,
        })
        .eq("id", pr.id);

      // Booking transitions
      if (pr.booking_id) {
        if (status === "SOLICITACAO_PAGO") {
          // Confirm booking (idempotent)
          const { data: b } = await supabase
            .from("bookings")
            .select("status")
            .eq("id", pr.booking_id)
            .maybeSingle();
          if (b && b.status !== "confirmed" && b.status !== "active" && b.status !== "in_progress" && b.status !== "completed") {
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
          }
        } else if (["BOLETO_EXPIRADO", "SOLICITACAO_CANCELADA", "SOLICITACAO_EXPIRADA", "CANCELADO", "EXPIRADO"].includes(status)) {
          await supabase
            .from("bookings")
            .update({ status: "cancelled", hold_expires_at: null })
            .eq("id", pr.booking_id);
        }
      }
    } catch (e) {
      console.error("webhook background error", e);
    }
  })();

  return ack;
});
