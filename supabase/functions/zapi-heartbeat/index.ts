import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { callZapi, normalizePhone, readZapiConfigAsync } from "../_shared/zapi.ts";

const ALLOWED_ROLES = new Set(["admin", "operations", "support"]);

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: cErr } = await anon.auth.getUser(token);
  if (cErr || !userData?.user?.id) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const hasRole = (roles || []).some((r: { role: string }) => ALLOWED_ROLES.has(r.role));
  if (!hasRole) {
    return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cfg = await readZapiConfigAsync();
  if (!cfg) {
    return new Response(JSON.stringify({ ok: false, reason: "not_configured" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const status = await callZapi(cfg, "/status", { method: "GET" });
  const phoneRes = status.ok ? await callZapi(cfg, "/phone", { method: "GET" }) : null;

  const connected =
    status.ok &&
    status.data &&
    typeof status.data === "object" &&
    // Z-API returns { connected: true, ... }
    ((status.data as { connected?: boolean }).connected === true);

  const phone =
    phoneRes && phoneRes.ok && phoneRes.data && typeof phoneRes.data === "object"
      ? normalizePhone(
          ((phoneRes.data as Record<string, unknown>).phone as string | undefined) || "",
        )
      : null;

  const { data: existing } = await admin
    .from("whatsapp_connection_status")
    .select("id")
    .limit(1)
    .maybeSingle();

  const patch = {
    status: connected ? "connected" : "disconnected",
    connected_phone: connected ? phone : null,
    last_heartbeat_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await admin.from("whatsapp_connection_status").update(patch).eq("id", existing.id);
  } else {
    await admin.from("whatsapp_connection_status").insert(patch);
  }

  return new Response(JSON.stringify({ ok: true, connected, phone, raw: status.data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
