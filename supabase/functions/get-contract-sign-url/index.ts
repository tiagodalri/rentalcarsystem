import { createClient } from "npm:@supabase/supabase-js@2";

import { buildCorsHeaders } from "../_shared/cors.ts";
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLICKSIGN_API_TOKEN = (Deno.env.get("CLICKSIGN_API_TOKEN") ?? "").replace(/^Bearer\s+/i, "").trim();
const CLICKSIGN_BASE_URL = (Deno.env.get("CLICKSIGN_BASE_URL") ?? "https://app.clicksign.com").replace(/\/$/, "");

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json(401, { error: "Unauthorized" });
    const userId = claimsData.claims.sub;

    const body = await req.json().catch(() => ({}));
    const bookingId: string | undefined = body?.booking_id;
    if (!bookingId) return json(400, { error: "booking_id obrigatório" });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: booking } = await admin
      .from("bookings")
      .select("id, customer_id, clicksign_envelope_id, contract_status")
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking) return json(404, { error: "Reserva não encontrada" });
    if (!booking.clicksign_envelope_id) return json(400, { error: "Contrato ainda não enviado" });

    // Authorization: customer dono OU equipe interna
    const [{ data: customer }, { data: roleRows }] = await Promise.all([
      admin.from("customers").select("user_id, email").eq("id", booking.customer_id!).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    const isStaff = roles.some((r) => ["admin", "operations", "support", "finance"].includes(r));
    const isOwner = customer?.user_id === userId;
    if (!isStaff && !isOwner) return json(403, { error: "Forbidden" });

    const csRes = await fetch(`${CLICKSIGN_BASE_URL}/api/v3/envelopes/${booking.clicksign_envelope_id}/signers`, {
      headers: {
        Authorization: CLICKSIGN_API_TOKEN,
        Accept: "application/vnd.api+json",
      },
    });
    if (!csRes.ok) {
      const txt = await csRes.text();
      return json(502, { error: `Clicksign: ${csRes.status} ${txt.slice(0, 300)}` });
    }
    const csJson = await csRes.json();
    const signers = Array.isArray(csJson?.data) ? csJson.data : [];

    // Para clientes finais, devolver só o link do próprio signer (por e-mail).
    // Para staff, devolver o link do signer cliente também (Sua Marca assina via API).
    const targetEmail = (customer?.email ?? "").trim().toLowerCase();
    const customerSigner = signers.find((s: any) => {
      const e = (s?.attributes?.email ?? "").trim().toLowerCase();
      return e === targetEmail;
    });

    const signUrl =
      customerSigner?.attributes?.sign_url ??
      customerSigner?.attributes?.url ??
      null;

    if (!signUrl) return json(404, { error: "Link de assinatura não disponível" });

    return json(200, { sign_url: signUrl, contract_status: booking.contract_status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[get-contract-sign-url] error:", msg);
    return json(500, { error: msg });
  }
});
