// B1 — Expira holds de bookings em 'pending_payment' cujo hold_expires_at já passou.
// Roda 1x/min via pg_cron. Idempotente. Libera o carro para outras buscas.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { buildCorsHeaders } from "../_shared/cors.ts";
serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const nowIso = new Date().toISOString();

  // Busca holds expirados
  const { data: expired, error } = await supabase
    .from("bookings")
    .select("id, booking_number, hold_expires_at")
    .eq("status", "pending_payment")
    .not("hold_expires_at", "is", null)
    .lt("hold_expires_at", nowIso)
    .limit(100);

  if (error) {
    console.error("[expire-holds] query error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!expired || expired.length === 0) {
    return new Response(JSON.stringify({ expired: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ids = expired.map((b) => b.id);
  const { error: updErr } = await supabase
    .from("bookings")
    .update({ status: "cancelled", hold_expires_at: null })
    .in("id", ids)
    .eq("status", "pending_payment"); // double-check para idempotência

  if (updErr) {
    console.error("[expire-holds] update error", updErr);
    return new Response(JSON.stringify({ error: updErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[expire-holds] cancelled ${ids.length} booking(s)`, ids);
  return new Response(JSON.stringify({ expired: ids.length, ids }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
