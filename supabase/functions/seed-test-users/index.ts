import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USERS = [
  { email: "admin@zeustest.com",      full_name: "Admin Teste",      role: "admin" },
  { email: "finance@zeustest.com",    full_name: "Finance Teste",    role: "finance" },
  { email: "operations@zeustest.com", full_name: "Operations Teste", role: "operations" },
  { email: "support@zeustest.com",    full_name: "Support Teste",    role: "support" },
];
const PASSWORD = "Teste1234";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: any[] = [];

  for (const u of USERS) {
    let userId: string | null = null;
    let note = "";

    // 1. Create or fetch user
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });

    if (createErr) {
      // Likely already exists — find it
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users.find((x) => x.email === u.email);
      if (existing) {
        userId = existing.id;
        note = "already existed";
      } else {
        results.push({ email: u.email, error: createErr.message });
        continue;
      }
    } else {
      userId = created.user!.id;
      note = "created";
    }

    // 2. Upsert team_members (trigger syncs user_roles)
    const { data: existingTm } = await supabase
      .from("team_members")
      .select("id")
      .eq("email", u.email)
      .maybeSingle();

    if (existingTm) {
      await supabase
        .from("team_members")
        .update({ user_id: userId, role: u.role, full_name: u.full_name, is_active: true })
        .eq("id", existingTm.id);
    } else {
      await supabase.from("team_members").insert({
        user_id: userId,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        is_active: true,
      });
    }

    results.push({ email: u.email, user_id: userId, role: u.role, note });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
