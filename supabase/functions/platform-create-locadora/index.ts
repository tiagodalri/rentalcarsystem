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

    // 1) Identify caller from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(401, { ok: false, error: "Invalid token" });
    }
    const callerId = userData.user.id;

    // 2) Enforce platform_admin server-side
    const { data: isPlat, error: platErr } = await admin.rpc("is_platform_admin", { uid: callerId });
    if (platErr) return json(500, { ok: false, error: platErr.message });
    if (!isPlat) return json(403, { ok: false, error: "Forbidden: platform_admin required" });

    const body = await req.json().catch(() => ({}));
    const {
      name,
      legal_name,
      contact_email,
      contact_phone,
      logo_url,
      admin_email,
      admin_password,
      admin_full_name,
    } = body ?? {};

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return json(400, { ok: false, error: "name is required" });
    }

    // 3) Create locadora
    const { data: loc, error: locErr } = await admin
      .from("locadoras")
      .insert({
        name: name.trim(),
        legal_name: legal_name ?? null,
        contact_email: contact_email ?? null,
        contact_phone: contact_phone ?? null,
        logo_url: logo_url ?? null,
      })
      .select("id")
      .single();
    if (locErr) return json(500, { ok: false, error: `locadora insert: ${locErr.message}` });
    const locadora_id = loc.id as string;

    // 4) Optionally create first admin
    let adminUserId: string | null = null;
    if (admin_email && admin_password && admin_full_name) {
      const email = String(admin_email).trim().toLowerCase();
      const password = String(admin_password);
      const fullName = String(admin_full_name).trim();

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createErr) {
        // Fallback: find existing and reset password
        const { data: list } = await admin.auth.admin.listUsers();
        const found = list?.users?.find((u) => u.email?.toLowerCase() === email);
        if (!found) return json(500, { ok: false, error: `auth create: ${createErr.message}` });
        adminUserId = found.id;
        await admin.auth.admin.updateUserById(adminUserId, { password, email_confirm: true });
      } else {
        adminUserId = created.user!.id;
      }

      // Insert team_members row (trigger will sync user_roles with locadora_id)
      const { error: tmErr } = await admin.from("team_members").insert({
        user_id: adminUserId,
        full_name: fullName,
        email,
        role: "admin",
        is_active: true,
        locadora_id,
      });
      if (tmErr) return json(500, { ok: false, error: `team_members insert: ${tmErr.message}` });

      // Verify user_roles row got the locadora_id; fallback upsert if needed
      const { data: urRow } = await admin
        .from("user_roles")
        .select("id, locadora_id")
        .eq("user_id", adminUserId)
        .eq("role", "admin")
        .maybeSingle();

      if (!urRow) {
        await admin.from("user_roles").insert({
          user_id: adminUserId,
          role: "admin",
          locadora_id,
        });
      } else if (urRow.locadora_id !== locadora_id) {
        await admin.from("user_roles").update({ locadora_id }).eq("id", urRow.id);
      }
    }

    return json(200, { ok: true, locadora_id, admin_user_id: adminUserId });
  } catch (e) {
    return json(500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
