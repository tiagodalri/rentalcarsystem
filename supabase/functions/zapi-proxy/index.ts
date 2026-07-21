import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildCorsHeaders } from "../_shared/cors.ts";
import {
  callZapi,
  normalizePhone,
  readZapiConfig,
  type ZapiConfig,
} from "../_shared/zapi.ts";

type Action =
  | "get-qrcode"
  | "check-status"
  | "get-phone"
  | "disconnect"
  | "restart"
  | "send-text"
  | "send-image"
  | "send-document"
  | "send-audio"
  | "list-chats"
  | "list-contacts"
  | "read-message";

interface ProxyBody {
  action: Action;
  payload?: Record<string, unknown>;
}

const ALLOWED_ROLES = new Set(["admin", "operations", "support"]);

function jsonResponse(body: unknown, init: ResponseInit, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

async function ensureCaller(req: Request): Promise<{ userId: string } | Response> {
  const corsHeaders = buildCorsHeaders(req);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "unauthorized" }, { status: 401 }, corsHeaders);
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    return jsonResponse({ ok: false, error: "unauthorized" }, { status: 401 }, corsHeaders);
  }
  const userId = data.user.id;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const hasRole = (roles || []).some((r: { role: string }) => ALLOWED_ROLES.has(r.role));
  if (!hasRole) {
    return jsonResponse({ ok: false, error: "forbidden" }, { status: 403 }, corsHeaders);
  }
  return { userId };
}

async function route(action: Action, payload: Record<string, unknown>, cfg: ZapiConfig) {
  switch (action) {
    case "get-qrcode":
      return await callZapi(cfg, "/qr-code/image", { method: "GET" });
    case "check-status":
      return await callZapi(cfg, "/status", { method: "GET" });
    case "get-phone":
      return await callZapi(cfg, "/phone", { method: "GET" });
    case "disconnect":
      return await callZapi(cfg, "/disconnect", { method: "GET" });
    case "restart":
      return await callZapi(cfg, "/restart", { method: "GET" });
    case "list-chats":
      return await callZapi(cfg, "/chats", { method: "GET" });
    case "list-contacts":
      return await callZapi(cfg, "/contacts", { method: "GET" });
    case "send-text": {
      const body = { phone: normalizePhone(String(payload.phone || "")), message: String(payload.message || "") };
      if (!body.phone || !body.message) return { ok: false, status: 400, data: { error: "missing_fields" } };
      return await callZapi(cfg, "/send-text", { method: "POST", body: JSON.stringify(body) });
    }
    case "send-image": {
      const body = {
        phone: normalizePhone(String(payload.phone || "")),
        image: String(payload.image || ""),
        caption: payload.caption ? String(payload.caption) : undefined,
      };
      if (!body.phone || !body.image) return { ok: false, status: 400, data: { error: "missing_fields" } };
      return await callZapi(cfg, "/send-image", { method: "POST", body: JSON.stringify(body) });
    }
    case "send-document": {
      const ext = String(payload.extension || "pdf").replace(/[^a-z0-9]/gi, "");
      const body = {
        phone: normalizePhone(String(payload.phone || "")),
        document: String(payload.document || ""),
        fileName: payload.fileName ? String(payload.fileName) : undefined,
      };
      if (!body.phone || !body.document) return { ok: false, status: 400, data: { error: "missing_fields" } };
      return await callZapi(cfg, `/send-document/${ext}`, { method: "POST", body: JSON.stringify(body) });
    }
    case "send-audio": {
      const body = {
        phone: normalizePhone(String(payload.phone || "")),
        audio: String(payload.audio || ""),
      };
      if (!body.phone || !body.audio) return { ok: false, status: 400, data: { error: "missing_fields" } };
      return await callZapi(cfg, "/send-audio", { method: "POST", body: JSON.stringify(body) });
    }
    case "read-message": {
      const body = {
        phone: normalizePhone(String(payload.phone || "")),
        messageId: String(payload.messageId || ""),
      };
      if (!body.phone || !body.messageId) return { ok: false, status: 400, data: { error: "missing_fields" } };
      return await callZapi(cfg, "/read-message", { method: "POST", body: JSON.stringify(body) });
    }
    default:
      return { ok: false, status: 400, data: { error: "unknown_action" } };
  }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, { status: 405 }, corsHeaders);
  }

  const authCheck = await ensureCaller(req);
  if (authCheck instanceof Response) return authCheck;

  let body: ProxyBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400 }, corsHeaders);
  }
  if (!body?.action) {
    return jsonResponse({ ok: false, error: "missing_action" }, { status: 400 }, corsHeaders);
  }

  const cfg = readZapiConfig();
  if (!cfg) {
    return jsonResponse(
      { ok: false, reason: "not_configured" },
      { status: 200 },
      corsHeaders,
    );
  }

  try {
    const result = await route(body.action, body.payload || {}, cfg);
    if (result.reason === "device_offline") {
      return jsonResponse({ ok: false, reason: "device_offline", data: result.data }, { status: 200 }, corsHeaders);
    }
    return jsonResponse(
      { ok: result.ok, status: result.status, data: result.data },
      { status: 200 },
      corsHeaders,
    );
  } catch (err) {
    console.error("[zapi-proxy] error", err);
    return jsonResponse(
      { ok: false, error: "upstream_failure", message: err instanceof Error ? err.message : String(err) },
      { status: 200 },
      corsHeaders,
    );
  }
});
