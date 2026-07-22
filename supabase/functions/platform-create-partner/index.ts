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
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { ok: false, error: "Missing Authorization" });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(401, { ok: false, error: "Invalid token" });
    }
    const callerId = userData.user.id;

    const { data: isPlat, error: platErr } = await admin.rpc("is_platform_admin", { uid: callerId });
    if (platErr) return json(500, { ok: false, error: platErr.message });
    if (!isPlat) return json(403, { ok: false, error: "Forbidden: platform_admin required" });

    const body = await req.json().catch(() => ({}));
    const {
      agency_name,
      contact_name,
      contact_email,
      contact_phone,
      notes,
      user_email,
      user_password,
      user_full_name,
    } = body ?? {};

    if (!agency_name || typeof agency_name !== "string" || agency_name.trim().length < 2) {
      return json(400, { ok: false, error: "agency_name is required" });
    }

    const { data: partner, error: pErr } = await admin
      .from("partners")
      .insert({
        agency_name: agency_name.trim(),
        contact_name: contact_name ?? null,
        contact_email: contact_email ?? null,
        contact_phone: contact_phone ?? null,
        notes: notes ?? null,
        created_by: callerId,
      })
      .select("id")
      .single();
    if (pErr) return json(500, { ok: false, error: `partners insert: ${pErr.message}` });
    const partner_id = partner.id as string;

    let partnerUserId: string | null = null;
    if (user_email && user_password && user_full_name) {
      const email = String(user_email).trim().toLowerCase();
      const password = String(user_password);
      const fullName = String(user_full_name).trim();

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

    return json(200, { ok: true, partner_id, user_id: partnerUserId });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
