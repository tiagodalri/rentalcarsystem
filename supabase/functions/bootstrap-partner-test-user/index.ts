import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_LOCADORA_ID = "d0da1220-0000-4000-8000-00000000d01a";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const email = "teste@teste.com";
    const password = "teste123";

    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Parceiro Teste" },
    });
    if (createErr) {
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users?.find((u) => u.email?.toLowerCase() === email);
      if (!found) throw createErr;
      userId = found.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      userId = created.user!.id;
    }

    // Ensure partner role for the default locadora
    const { data: existing } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId!)
      .eq("role", "partner")
      .maybeSingle();

    if (!existing) {
      const { error: insErr } = await admin.from("user_roles").insert({
        user_id: userId,
        role: "partner",
        locadora_id: DEFAULT_LOCADORA_ID,
      });
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ ok: true, user_id: userId, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
