import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildCorsHeaders } from "../_shared/cors.ts";
import {
  callZapi,
  isMaskedOrEmpty,
  maskSecret,
  normalizePhone,
  readZapiConfigAsync,
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
  | "read-message"
  | "save-config"
  | "get-config-status";

interface ProxyBody {
  action: Action;
  payload?: Record<string, unknown>;
}

const MESSAGING_ROLES = new Set(["admin", "operations", "support"]);
const CONFIG_ROLES = new Set(["admin"]);
const ADMIN_ACTIONS = new Set<Action>(["save-config", "get-config-status"]);
const SEND_ACTIONS = new Set<Action>(["send-text", "send-image", "send-document", "send-audio"]);

function jsonResponse(body: unknown, init: ResponseInit, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

function svcClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function authenticate(
  req: Request,
  action: Action,
): Promise<{ userId: string; email: string | null } | Response> {
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
  const email = data.user.email ?? null;

  const admin = svcClient();
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const allowed = ADMIN_ACTIONS.has(action) ? CONFIG_ROLES : MESSAGING_ROLES;
  const hasRole = (roles || []).some((r: { role: string }) => allowed.has(r.role));
  if (!hasRole) {
    return jsonResponse({ ok: false, error: "forbidden" }, { status: 403 }, corsHeaders);
  }
  return { userId, email };
}

interface RecordOutboundInput {
  conversationId?: string | null;
  phone: string;
  content: string;
  externalId: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  messageType?: "text" | "image" | "audio" | "video" | "document";
  mediaUrl?: string | null;
  mediaMimetype?: string | null;
  senderName?: string | null;
}

/**
 * Ensure a conversation exists for a given phone. Returns its id.
 */
async function ensureConversation(svc: SupabaseClient, phone: string): Promise<string | null> {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  const externalId = `wa_${digits}`;
  const { data: existing } = await svc
    .from("whatsapp_conversations")
    .select("id")
    .eq("phone", digits)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created } = await svc
    .from("whatsapp_conversations")
    .insert({
      phone: digits,
      external_conversation_id: externalId,
      is_group: false,
      status: "open",
      unread_count: 0,
    })
    .select("id")
    .maybeSingle();
  return (created?.id as string) ?? null;
}

/** Insert outbound message + bump conversation preview. Never throws. */
async function recordOutboundMessage(svc: SupabaseClient, input: RecordOutboundInput) {
  try {
    let convId = input.conversationId ?? null;
    if (!convId) {
      convId = await ensureConversation(svc, input.phone);
    }
    if (!convId) return null;

    const now = new Date().toISOString();
    const messageType = input.messageType ?? "text";
    const preview =
      messageType === "text"
        ? (input.content || "").slice(0, 120)
        : messageType === "image"
        ? "[imagem]"
        : messageType === "document"
        ? `[documento] ${input.content || ""}`.trim()
        : messageType === "audio"
        ? "[áudio]"
        : messageType === "video"
        ? "[vídeo]"
        : (input.content || "").slice(0, 120);

    await svc.from("whatsapp_messages").insert({
      conversation_id: convId,
      external_message_id: input.externalId,
      direction: "outbound",
      message_type: messageType,
      content: input.content || null,
      media_url: input.mediaUrl ?? null,
      media_mimetype: input.mediaMimetype ?? null,
      status: input.status,
      sender_name: input.senderName ?? "GoDalz",
      timestamp: now,
    });

    await svc
      .from("whatsapp_conversations")
      .update({
        last_message_at: now,
        last_message_preview: preview,
        updated_at: now,
      })
      .eq("id", convId);

    return convId;
  } catch (err) {
    console.error("[zapi-proxy] recordOutboundMessage failed", err);
    return null;
  }
}

interface SendResult {
  ok: boolean;
  status?: number;
  data?: unknown;
  reason?: string;
  simulated?: boolean;
}

async function handleSendText(
  cfg: ZapiConfig | null,
  svc: SupabaseClient,
  payload: Record<string, unknown>,
  senderName: string | null,
): Promise<SendResult> {
  const phone = normalizePhone(String(payload.phone || ""));
  const message = String(payload.message || "");
  const conversationId = (payload.conversationId as string) || null;
  if (!phone || !message) return { ok: false, status: 400, data: { error: "missing_fields" } };

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId,
      phone,
      content: message,
      externalId,
      status: "sent",
      messageType: "text",
      senderName,
    });
    return { ok: true, simulated: true, reason: "not_configured", data: { externalId } };
  }

  const res = await callZapi(cfg, "/send-text", {
    method: "POST",
    body: JSON.stringify({ phone, message }),
  });
  if (res.ok) {
    const d = (res.data ?? {}) as { messageId?: string; zaapId?: string };
    const externalId = d.messageId || d.zaapId || `sent-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId,
      phone,
      content: message,
      externalId,
      status: "sent",
      messageType: "text",
      senderName,
    });
  }
  return { ok: res.ok, status: res.status, data: res.data, reason: res.reason };
}

async function handleSendImage(
  cfg: ZapiConfig | null,
  svc: SupabaseClient,
  payload: Record<string, unknown>,
  senderName: string | null,
): Promise<SendResult> {
  const phone = normalizePhone(String(payload.phone || ""));
  const image = String(payload.image || "");
  const caption = payload.caption ? String(payload.caption) : "";
  const conversationId = (payload.conversationId as string) || null;
  if (!phone || !image) return { ok: false, status: 400, data: { error: "missing_fields" } };

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId,
      phone,
      content: caption,
      externalId,
      status: "sent",
      messageType: "image",
      mediaUrl: image,
      senderName,
    });
    return { ok: true, simulated: true, reason: "not_configured", data: { externalId } };
  }

  const res = await callZapi(cfg, "/send-image", {
    method: "POST",
    body: JSON.stringify({ phone, image, caption: caption || undefined }),
  });
  if (res.ok) {
    const d = (res.data ?? {}) as { messageId?: string; zaapId?: string };
    const externalId = d.messageId || d.zaapId || `sent-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId,
      phone,
      content: caption,
      externalId,
      status: "sent",
      messageType: "image",
      mediaUrl: image,
      senderName,
    });
  }
  return { ok: res.ok, status: res.status, data: res.data, reason: res.reason };
}

async function handleSendDocument(
  cfg: ZapiConfig | null,
  svc: SupabaseClient,
  payload: Record<string, unknown>,
  senderName: string | null,
): Promise<SendResult> {
  const phone = normalizePhone(String(payload.phone || ""));
  const document = String(payload.document || "");
  const fileName = payload.fileName ? String(payload.fileName) : "documento";
  const ext = String(payload.extension || "pdf").replace(/[^a-z0-9]/gi, "");
  const conversationId = (payload.conversationId as string) || null;
  if (!phone || !document) return { ok: false, status: 400, data: { error: "missing_fields" } };

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId,
      phone,
      content: fileName,
      externalId,
      status: "sent",
      messageType: "document",
      mediaUrl: document,
      senderName,
    });
    return { ok: true, simulated: true, reason: "not_configured", data: { externalId } };
  }

  const res = await callZapi(cfg, `/send-document/${ext}`, {
    method: "POST",
    body: JSON.stringify({ phone, document, fileName }),
  });
  if (res.ok) {
    const d = (res.data ?? {}) as { messageId?: string; zaapId?: string };
    const externalId = d.messageId || d.zaapId || `sent-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId,
      phone,
      content: fileName,
      externalId,
      status: "sent",
      messageType: "document",
      mediaUrl: document,
      senderName,
    });
  }
  return { ok: res.ok, status: res.status, data: res.data, reason: res.reason };
}

async function routeReadOnly(action: Action, payload: Record<string, unknown>, cfg: ZapiConfig) {
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

/** Admin-only: read current config, returning MASKED values only. */
async function handleGetConfigStatus(): Promise<Record<string, unknown>> {
  const svc = svcClient();
  const { data } = await svc
    .from("zapi_config")
    .select("instance_id, token, client_token, webhook_secret, updated_at, updated_by")
    .eq("id", 1)
    .maybeSingle();

  const row = (data ?? {}) as Record<string, string | null>;
  const envFallback = {
    instance_id: Deno.env.get("ZAPI_INSTANCE_ID") ?? null,
    token: Deno.env.get("ZAPI_TOKEN") ?? null,
    client_token: Deno.env.get("ZAPI_CLIENT_TOKEN") ?? null,
    webhook_secret: Deno.env.get("ZAPI_WEBHOOK_SECRET") ?? null,
  };

  const merged = {
    instance_id: row.instance_id || envFallback.instance_id,
    token: row.token || envFallback.token,
    client_token: row.client_token || envFallback.client_token,
    webhook_secret: row.webhook_secret || envFallback.webhook_secret,
  };
  const source = row.instance_id || row.token || row.client_token ? "db" : "env";
  const configured =
    !!merged.instance_id && !!merged.token && !!merged.client_token;

  return {
    ok: true,
    configured,
    source,
    updated_at: row.updated_at ?? null,
    values: {
      instance_id: maskSecret(merged.instance_id),
      token: maskSecret(merged.token),
      client_token: maskSecret(merged.client_token),
      webhook_secret: maskSecret(merged.webhook_secret),
    },
    has: {
      instance_id: !!merged.instance_id,
      token: !!merged.token,
      client_token: !!merged.client_token,
      webhook_secret: !!merged.webhook_secret,
    },
  };
}

async function handleSaveConfig(
  userId: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const svc = svcClient();
  const patch: Record<string, string | null> = {};
  const fields: Array<"instance_id" | "token" | "client_token" | "webhook_secret"> = [
    "instance_id",
    "token",
    "client_token",
    "webhook_secret",
  ];
  const camel: Record<string, string> = {
    instance_id: "instanceId",
    token: "token",
    client_token: "clientToken",
    webhook_secret: "webhookSecret",
  };
  for (const f of fields) {
    const val = payload[f] ?? payload[camel[f]];
    if (isMaskedOrEmpty(val)) continue;
    patch[f] = String(val).trim();
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, updated: 0, message: "no_changes" };
  }

  const { error } = await svc
    .from("zapi_config")
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString(), updated_by: userId });

  if (error) return { ok: false, error: error.message };
  return { ok: true, updated: Object.keys(patch).length };
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, { status: 405 }, corsHeaders);
  }

  let body: ProxyBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400 }, corsHeaders);
  }
  if (!body?.action) {
    return jsonResponse({ ok: false, error: "missing_action" }, { status: 400 }, corsHeaders);
  }

  const authCheck = await authenticate(req, body.action);
  if (authCheck instanceof Response) return authCheck;

  if (body.action === "get-config-status") {
    return jsonResponse(await handleGetConfigStatus(), { status: 200 }, corsHeaders);
  }
  if (body.action === "save-config") {
    const res = await handleSaveConfig(authCheck.userId, body.payload || {});
    return jsonResponse(res, { status: res.ok ? 200 : 400 }, corsHeaders);
  }

  const cfg = await readZapiConfigAsync();
  const svc = svcClient();
  const senderName = authCheck.email;

  try {
    // Send actions accept cfg=null (demo mode) and always persist the message.
    if (SEND_ACTIONS.has(body.action)) {
      const payload = body.payload || {};
      let res: SendResult;
      if (body.action === "send-text") {
        res = await handleSendText(cfg, svc, payload, senderName);
      } else if (body.action === "send-image") {
        res = await handleSendImage(cfg, svc, payload, senderName);
      } else if (body.action === "send-document") {
        res = await handleSendDocument(cfg, svc, payload, senderName);
      } else {
        // send-audio: not persisted (rarely used, real-only for now)
        if (!cfg) return jsonResponse({ ok: false, reason: "not_configured" }, { status: 200 }, corsHeaders);
        const r = await routeReadOnly(body.action, payload, cfg);
        res = { ok: r.ok, status: r.status, data: r.data, reason: r.reason };
      }
      if (res.reason === "device_offline") {
        return jsonResponse({ ok: false, reason: "device_offline", data: res.data }, { status: 200 }, corsHeaders);
      }
      return jsonResponse(res, { status: 200 }, corsHeaders);
    }

    // Read-only actions require Z-API to be configured.
    if (!cfg) {
      return jsonResponse({ ok: false, reason: "not_configured" }, { status: 200 }, corsHeaders);
    }
    const result = await routeReadOnly(body.action, body.payload || {}, cfg);
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
