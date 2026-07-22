import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { appUrl, sendPartnerEmail } from "../_shared/partnerEmails.ts";

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

    const body = await req.json().catch(() => ({}));
    const awardId = body?.award_id;
    const status = body?.status === "pending" ? "pending" : "paid";
    if (!awardId || typeof awardId !== "string") {
      return json(400, { ok: false, error: "award_id required" });
    }

    // Caller must be platform_admin
    const { data: roles, error: rErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    if (rErr) return json(500, { ok: false, error: rErr.message });

    const isPlatformAdmin = (roles ?? []).some((r: { role: string }) => r.role === "platform_admin");
    if (!isPlatformAdmin) return json(403, { ok: false, error: "Forbidden — platform admin only" });

    const patch = status === "paid"
      ? { payout_status: "paid", paid_at: new Date().toISOString() }
      : { payout_status: "pending", paid_at: null };

    const { error: uErr } = await admin
      .from("partner_bonus_awards")
      .update(patch)
      .eq("id", awardId);
    if (uErr) return json(500, { ok: false, error: uErr.message });

    // Notify partner when bonus is marked paid — non-fatal
    if (status === "paid") {
      try {
        const { data: award } = await admin
          .from("partner_bonus_awards")
          .select("id, paid_at, partner_id, tier_id")
          .eq("id", awardId)
          .maybeSingle();
        if (award?.partner_id) {
          const [{ data: partner }, { data: tier }] = await Promise.all([
            admin.from("partners").select("agency_name, contact_email").eq("id", award.partner_id).maybeSingle(),
            award.tier_id
              ? admin.from("partner_bonus_tiers").select("threshold_bookings, bonus_amount, name").eq("id", award.tier_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          if (partner?.contact_email) {
            const amountStr =
              tier && typeof tier.bonus_amount === "number"
                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(tier.bonus_amount)
                : "—";
            const tierLabel = tier
              ? tier.name ?? `Missão ${tier.threshold_bookings ?? "—"} reservas`
              : "Missão concluída";
            const paidAtStr = award.paid_at
              ? new Date(award.paid_at).toLocaleString("pt-BR")
              : new Date().toLocaleString("pt-BR");
            await sendPartnerEmail({
              templateName: "partner-payout-processed",
              recipientEmail: partner.contact_email,
              idempotencyKey: `bonus-paid-${awardId}-${award.paid_at ?? "now"}`,
              templateData: {
                agencyName: partner.agency_name,
                payoutKind: "Bônus",
                amount: amountStr,
                reference: tierLabel,
                paidAt: paidAtStr,
                dashboardUrl: appUrl("/parceiro/comissoes"),
              },
            });
          }
        }
      } catch (e) {
        console.error("[mark-bonus-paid] notify failed:", e);
      }
    }

    return json(200, { ok: true, award_id: awardId, payout_status: status });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
