// Platform-admin only. Approves or rejects a partner application.
// On approve: creates the partners row (from application snapshot) and, if creds provided,
// creates the auth user + user_roles(partner) — reusing the same pattern as platform-create-partner.
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

    const { data: isPlat, error: platErr } = await admin.rpc("is_platform_admin", { uid: callerId });
    if (platErr) return json(500, { ok: false, error: platErr.message });
    if (!isPlat) return json(403, { ok: false, error: "Forbidden: platform_admin required" });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const application_id = typeof body?.application_id === "string" ? body.application_id : null;
    const decision = body?.decision;
    const review_notes = typeof body?.review_notes === "string" ? body.review_notes.trim() || null : null;
    if (!application_id) return json(400, { ok: false, error: "application_id is required" });
    if (decision !== "approve" && decision !== "reject") {
      return json(400, { ok: false, error: "decision must be 'approve' or 'reject'" });
    }

    const { data: app, error: aErr } = await admin
      .from("partner_applications")
      .select("*")
      .eq("id", application_id)
      .maybeSingle();
    if (aErr) return json(500, { ok: false, error: aErr.message });
    if (!app) return json(404, { ok: false, error: "Application not found" });
    if (app.status !== "pending") {
      return json(409, { ok: false, error: "Solicitação já foi processada anteriormente." });
    }

    if (decision === "reject") {
      const { error: upErr } = await admin
        .from("partner_applications")
        .update({
          status: "rejected",
          reviewed_by: callerId,
          reviewed_at: new Date().toISOString(),
          review_notes,
        })
        .eq("id", application_id);
      if (upErr) return json(500, { ok: false, error: upErr.message });
      return json(200, { ok: true });
    }

    // Approve
    const partnerInsert: Record<string, unknown> = {
      agency_name: app.agency_name,
      legal_name: app.legal_name,
      cnpj: app.cnpj,
      state_registration: app.state_registration,
      contact_name: app.contact_name,
      contact_role: app.contact_role,
      contact_email: app.contact_email,
      contact_phone: app.contact_phone,
      address_zip: app.address_zip,
      address_street: app.address_street,
      address_number: app.address_number,
      address_complement: app.address_complement,
      address_neighborhood: app.address_neighborhood,
      address_city: app.address_city,
      address_state: app.address_state,
      status: "active",
      created_by: callerId,
      notes: `Aprovado a partir de solicitação pública em ${new Date().toLocaleDateString("pt-BR")}`,
    };

    const { data: partner, error: pErr } = await admin
      .from("partners")
      .insert(partnerInsert)
      .select("id")
      .single();
    if (pErr) return json(500, { ok: false, error: `partners insert: ${pErr.message}` });
    const partner_id = partner.id as string;

    // Optional: create the first partner user in the same step
    const user_email = typeof body?.user_email === "string" ? body.user_email : null;
    const user_password = typeof body?.user_password === "string" ? body.user_password : null;
    const user_full_name = typeof body?.user_full_name === "string" ? body.user_full_name : null;

    let partnerUserId: string | null = null;
    if (user_email && user_password && user_full_name) {
      const email = user_email.trim().toLowerCase();
      const password = String(user_password);
      const fullName = user_full_name.trim();

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createErr) {
        const { data: list } = await admin.auth.admin.listUsers();
        const found = list?.users?.find((u) => u.email?.toLowerCase() === email);
        if (!found) return json(500, { ok: false, error: `auth create: ${createErr.message}` });
        partnerUserId = found.id;
        await admin.auth.admin.updateUserById(partnerUserId, { password, email_confirm: true });
      } else {
        partnerUserId = created.user!.id;
      }

      const { error: urErr } = await admin.from("user_roles").insert({
        user_id: partnerUserId,
        role: "partner",
        partner_id,
        locadora_id: null,
      });
      if (urErr) return json(500, { ok: false, error: `user_roles insert: ${urErr.message}` });
    }

    const { error: upErr } = await admin
      .from("partner_applications")
      .update({
        status: "approved",
        reviewed_by: callerId,
        reviewed_at: new Date().toISOString(),
        review_notes,
        created_partner_id: partner_id,
      })
      .eq("id", application_id);
    if (upErr) return json(500, { ok: false, error: upErr.message });

    return json(200, { ok: true, partner_id, user_id: partnerUserId });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
