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
import {
  ensureConversation,
  recordOutboundMessage,
  type RecordOutboundInput,
} from "../_shared/whatsappRecord.ts";

type Action =
  | "get-qrcode"
  | "check-status"
  | "get-phone"
  | "disconnect"
  | "restart"
  | "send-text"
  | "send-image"
  | "send-video"
  | "send-document"
  | "send-audio"
  | "send-sticker"
  | "send-location"
  | "send-contact"
  | "send-text-status"
  | "send-image-status"
  | "send-video-status"
  | "reply-status-text"
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
const SEND_ACTIONS = new Set<Action>([
  "send-text", "send-image", "send-video", "send-document",
  "send-audio", "send-sticker", "send-location", "send-contact",
  "send-text-status", "send-image-status", "send-video-status", "reply-status-text",
]);


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

interface SendResult {
  ok: boolean;
  status?: number;
  data?: unknown;
  reason?: string;
  simulated?: boolean;
}

function extractExtras(payload: Record<string, unknown>) {
  return {
    replyToMessageId: (payload.replyToMessageId as string) || null,
    forwardedFromMessageId: (payload.forwardedFromMessageId as string) || null,
  };
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
  const extras = extractExtras(payload);
  if (!phone || !message) return { ok: false, status: 400, data: { error: "missing_fields" } };

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: message, externalId,
      status: "sent", messageType: "text", senderName, ...extras,
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
      conversationId, phone, content: message, externalId,
      status: "sent", messageType: "text", senderName, ...extras,
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
  const extras = extractExtras(payload);
  if (!phone || !image) return { ok: false, status: 400, data: { error: "missing_fields" } };

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: caption, externalId,
      status: "sent", messageType: "image", mediaUrl: image, senderName, ...extras,
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
      conversationId, phone, content: caption, externalId,
      status: "sent", messageType: "image", mediaUrl: image, senderName, ...extras,
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
  const extras = extractExtras(payload);
  if (!phone || !document) return { ok: false, status: 400, data: { error: "missing_fields" } };

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: fileName, externalId,
      status: "sent", messageType: "document", mediaUrl: document, senderName, ...extras,
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
      conversationId, phone, content: fileName, externalId,
      status: "sent", messageType: "document", mediaUrl: document, senderName, ...extras,
    });
  }
  return { ok: res.ok, status: res.status, data: res.data, reason: res.reason };
}

async function handleSendVideo(
  cfg: ZapiConfig | null,
  svc: SupabaseClient,
  payload: Record<string, unknown>,
  senderName: string | null,
): Promise<SendResult> {
  const phone = normalizePhone(String(payload.phone || ""));
  const video = String(payload.video || "");
  const caption = payload.caption ? String(payload.caption) : "";
  const conversationId = (payload.conversationId as string) || null;
  const extras = extractExtras(payload);
  if (!phone || !video) return { ok: false, status: 400, data: { error: "missing_fields" } };

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: caption, externalId,
      status: "sent", messageType: "video", mediaUrl: video, senderName, ...extras,
    });
    return { ok: true, simulated: true, reason: "not_configured", data: { externalId } };
  }

  const res = await callZapi(cfg, "/send-video", {
    method: "POST",
    body: JSON.stringify({ phone, video, caption: caption || undefined }),
  });
  if (res.ok) {
    const d = (res.data ?? {}) as { messageId?: string; zaapId?: string };
    const externalId = d.messageId || d.zaapId || `sent-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: caption, externalId,
      status: "sent", messageType: "video", mediaUrl: video, senderName, ...extras,
    });
  }
  return { ok: res.ok, status: res.status, data: res.data, reason: res.reason };
}

async function handleSendAudio(
  cfg: ZapiConfig | null,
  svc: SupabaseClient,
  payload: Record<string, unknown>,
  senderName: string | null,
): Promise<SendResult> {
  const phone = normalizePhone(String(payload.phone || ""));
  const audio = String(payload.audio || "");
  const conversationId = (payload.conversationId as string) || null;
  const extras = extractExtras(payload);
  if (!phone || !audio) return { ok: false, status: 400, data: { error: "missing_fields" } };

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: "", externalId,
      status: "sent", messageType: "audio", mediaUrl: audio, senderName, ...extras,
    });
    return { ok: true, simulated: true, reason: "not_configured", data: { externalId } };
  }

  const res = await callZapi(cfg, "/send-audio", {
    method: "POST",
    body: JSON.stringify({ phone, audio }),
  });
  if (res.ok) {
    const d = (res.data ?? {}) as { messageId?: string; zaapId?: string };
    const externalId = d.messageId || d.zaapId || `sent-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: "", externalId,
      status: "sent", messageType: "audio", mediaUrl: audio, senderName, ...extras,
    });
  }
  return { ok: res.ok, status: res.status, data: res.data, reason: res.reason };
}

async function handleSendSticker(
  cfg: ZapiConfig | null,
  svc: SupabaseClient,
  payload: Record<string, unknown>,
  senderName: string | null,
): Promise<SendResult> {
  const phone = normalizePhone(String(payload.phone || ""));
  const sticker = String(payload.sticker || "");
  const conversationId = (payload.conversationId as string) || null;
  const extras = extractExtras(payload);
  if (!phone || !sticker) return { ok: false, status: 400, data: { error: "missing_fields" } };

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: "", externalId,
      status: "sent", messageType: "sticker", mediaUrl: sticker, senderName, ...extras,
    });
    return { ok: true, simulated: true, reason: "not_configured", data: { externalId } };
  }

  // Z-API: /send-sticker. Falls back to /send-image if sticker endpoint unavailable.
  let res = await callZapi(cfg, "/send-sticker", {
    method: "POST",
    body: JSON.stringify({ phone, sticker }),
  });
  if (!res.ok && res.status === 404) {
    res = await callZapi(cfg, "/send-image", {
      method: "POST",
      body: JSON.stringify({ phone, image: sticker }),
    });
  }
  if (res.ok) {
    const d = (res.data ?? {}) as { messageId?: string; zaapId?: string };
    const externalId = d.messageId || d.zaapId || `sent-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: "", externalId,
      status: "sent", messageType: "sticker", mediaUrl: sticker, senderName, ...extras,
    });
  }
  return { ok: res.ok, status: res.status, data: res.data, reason: res.reason };
}

async function handleSendLocation(
  cfg: ZapiConfig | null,
  svc: SupabaseClient,
  payload: Record<string, unknown>,
  senderName: string | null,
): Promise<SendResult> {
  const phone = normalizePhone(String(payload.phone || ""));
  const lat = Number(payload.latitude ?? payload.lat);
  const lng = Number(payload.longitude ?? payload.lng);
  const label = payload.label ? String(payload.label) : "";
  const address = payload.address ? String(payload.address) : label;
  const conversationId = (payload.conversationId as string) || null;
  const extras = extractExtras(payload);
  if (!phone || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, status: 400, data: { error: "missing_fields" } };
  }

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: label, externalId,
      status: "sent", messageType: "location", senderName,
      locationLat: lat, locationLng: lng, locationLabel: label || address, ...extras,
    });
    return { ok: true, simulated: true, reason: "not_configured", data: { externalId } };
  }

  const res = await callZapi(cfg, "/send-location", {
    method: "POST",
    body: JSON.stringify({ phone, latitude: lat, longitude: lng, title: label || undefined, address: address || undefined }),
  });
  if (res.ok) {
    const d = (res.data ?? {}) as { messageId?: string; zaapId?: string };
    const externalId = d.messageId || d.zaapId || `sent-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: label, externalId,
      status: "sent", messageType: "location", senderName,
      locationLat: lat, locationLng: lng, locationLabel: label || address, ...extras,
    });
  }
  return { ok: res.ok, status: res.status, data: res.data, reason: res.reason };
}

async function handleSendContact(
  cfg: ZapiConfig | null,
  svc: SupabaseClient,
  payload: Record<string, unknown>,
  senderName: string | null,
): Promise<SendResult> {
  const phone = normalizePhone(String(payload.phone || ""));
  const contactName = String(payload.contactName || "").trim();
  const contactPhone = normalizePhone(String(payload.contactPhone || ""));
  const conversationId = (payload.conversationId as string) || null;
  const extras = extractExtras(payload);
  if (!phone || !contactName || !contactPhone) {
    return { ok: false, status: 400, data: { error: "missing_fields" } };
  }
  const content = `${contactName} · +${contactPhone}`;

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content, externalId,
      status: "sent", messageType: "contact", senderName, ...extras,
    });
    return { ok: true, simulated: true, reason: "not_configured", data: { externalId } };
  }

  const res = await callZapi(cfg, "/send-contact", {
    method: "POST",
    body: JSON.stringify({ phone, contactName, contactPhone }),
  });
  if (res.ok) {
    const d = (res.data ?? {}) as { messageId?: string; zaapId?: string };
    const externalId = d.messageId || d.zaapId || `sent-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content, externalId,
      status: "sent", messageType: "contact", senderName, ...extras,
    });
  }
  return { ok: res.ok, status: res.status, data: res.data, reason: res.reason };
}

// ============================================================
// STATUS (Stories) actions — real Z-API status endpoints
// ============================================================

type StatusType = "text" | "image" | "video";

async function recordStatusRow(
  svc: SupabaseClient,
  input: {
    type: StatusType;
    userId: string | null;
    senderName: string | null;
    externalStatusId: string | null;
    externalZaapId: string | null;
    text?: string | null;
    backgroundColor?: string | null;
    font?: string | null;
    mediaUrl?: string | null;
    caption?: string | null;
  },
) {
  const now = new Date().toISOString();
  const { data, error } = await svc.from("whatsapp_statuses").insert({
    status_type: input.type,
    text_content: input.text ?? null,
    background_color: input.backgroundColor ?? null,
    font: input.font ?? null,
    media_url: input.mediaUrl ?? null,
    caption: input.caption ?? null,
    is_mine: true,
    posted_by: input.userId,
    posted_by_name: input.senderName,
    external_status_id: input.externalStatusId,
    external_zaap_id: input.externalZaapId,
    posted_at: now,
  }).select("id").single();
  if (error) console.warn("[zapi-proxy] failed to record status", error.message);
  return (data as { id: string } | null)?.id ?? null;
}

async function handleSendTextStatus(
  cfg: ZapiConfig | null,
  svc: SupabaseClient,
  payload: Record<string, unknown>,
  userId: string,
  senderName: string | null,
): Promise<SendResult> {
  const text = String(payload.text || "").trim();
  const backgroundColor = payload.backgroundColor ? String(payload.backgroundColor) : null;
  const font = payload.font ? String(payload.font) : null;
  if (!text) return { ok: false, status: 400, data: { error: "missing_fields" } };

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordStatusRow(svc, {
      type: "text", userId, senderName,
      externalStatusId: externalId, externalZaapId: null,
      text, backgroundColor, font,
    });
    return { ok: true, simulated: true, reason: "not_configured", data: { externalId } };
  }

  const res = await callZapi(cfg, "/send-text-status", {
    method: "POST",
    body: JSON.stringify({ message: text }),
  });
  if (res.ok) {
    const d = (res.data ?? {}) as { messageId?: string; zaapId?: string; id?: string };
    const externalId = d.messageId || d.id || d.zaapId || `sent-${crypto.randomUUID()}`;
    await recordStatusRow(svc, {
      type: "text", userId, senderName,
      externalStatusId: externalId, externalZaapId: d.zaapId ?? null,
      text, backgroundColor, font,
    });
  }
  return { ok: res.ok, status: res.status, data: res.data, reason: res.reason };
}

async function handleSendImageStatus(
  cfg: ZapiConfig | null,
  svc: SupabaseClient,
  payload: Record<string, unknown>,
  userId: string,
  senderName: string | null,
): Promise<SendResult> {
  const image = String(payload.imageUrl || payload.imageBase64 || payload.image || "");
  const caption = payload.caption ? String(payload.caption) : null;
  if (!image) return { ok: false, status: 400, data: { error: "missing_fields" } };

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordStatusRow(svc, {
      type: "image", userId, senderName,
      externalStatusId: externalId, externalZaapId: null,
      mediaUrl: image, caption,
    });
    return { ok: true, simulated: true, reason: "not_configured", data: { externalId } };
  }

  const res = await callZapi(cfg, "/send-image-status", {
    method: "POST",
    body: JSON.stringify({ image, caption: caption ?? undefined }),
  });
  if (res.ok) {
    const d = (res.data ?? {}) as { messageId?: string; zaapId?: string; id?: string };
    const externalId = d.messageId || d.id || d.zaapId || `sent-${crypto.randomUUID()}`;
    await recordStatusRow(svc, {
      type: "image", userId, senderName,
      externalStatusId: externalId, externalZaapId: d.zaapId ?? null,
      mediaUrl: image, caption,
    });
  }
  return { ok: res.ok, status: res.status, data: res.data, reason: res.reason };
}

async function handleSendVideoStatus(
  cfg: ZapiConfig | null,
  svc: SupabaseClient,
  payload: Record<string, unknown>,
  userId: string,
  senderName: string | null,
): Promise<SendResult> {
  const videoUrl = payload.videoUrl ? String(payload.videoUrl) : "";
  const videoBase64 = payload.videoBase64 ? String(payload.videoBase64) : "";
  const video = videoUrl || videoBase64 || String(payload.video || "");
  const caption = payload.caption ? String(payload.caption) : null;
  if (!video) return { ok: false, status: 400, data: { error: "missing_fields" } };

  // 10MB limit for base64 payloads (NatLeva pattern)
  if (videoBase64 && videoBase64.length * 0.75 > 10 * 1024 * 1024) {
    return { ok: false, status: 400, data: { error: "Video exceeds 10MB limit" } };
  }

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordStatusRow(svc, {
      type: "video", userId, senderName,
      externalStatusId: externalId, externalZaapId: null,
      mediaUrl: video, caption,
    });
    return { ok: true, simulated: true, reason: "not_configured", data: { externalId } };
  }

  const res = await callZapi(cfg, "/send-video-status", {
    method: "POST",
    body: JSON.stringify({ video, caption: caption ?? undefined }),
  });
  if (res.ok) {
    const d = (res.data ?? {}) as { messageId?: string; zaapId?: string; id?: string };
    const externalId = d.messageId || d.id || d.zaapId || `sent-${crypto.randomUUID()}`;
    await recordStatusRow(svc, {
      type: "video", userId, senderName,
      externalStatusId: externalId, externalZaapId: d.zaapId ?? null,
      mediaUrl: video, caption,
    });
  }
  return { ok: res.ok, status: res.status, data: res.data, reason: res.reason };
}

async function handleReplyStatusText(
  cfg: ZapiConfig | null,
  svc: SupabaseClient,
  payload: Record<string, unknown>,
  senderName: string | null,
): Promise<SendResult> {
  const phone = normalizePhone(String(payload.phone || ""));
  const message = String(payload.message || "");
  const statusMessageId = String(payload.statusMessageId || "");
  const conversationId = (payload.conversationId as string) || null;
  if (!phone || !message || !statusMessageId) {
    return { ok: false, status: 400, data: { error: "missing_fields" } };
  }

  if (!cfg) {
    const externalId = `demo-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: message, externalId,
      status: "sent", messageType: "text", senderName,
      replyToMessageId: statusMessageId, forwardedFromMessageId: null,
    });
    return { ok: true, simulated: true, reason: "not_configured", data: { externalId } };
  }

  const res = await callZapi(cfg, "/reply-status-text", {
    method: "POST",
    body: JSON.stringify({ phone, message, statusMessageId }),
  });
  if (res.ok) {
    const d = (res.data ?? {}) as { messageId?: string; zaapId?: string };
    const externalId = d.messageId || d.zaapId || `sent-${crypto.randomUUID()}`;
    await recordOutboundMessage(svc, {
      conversationId, phone, content: message, externalId,
      status: "sent", messageType: "text", senderName,
      replyToMessageId: statusMessageId, forwardedFromMessageId: null,
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
      switch (body.action) {
        case "send-text":     res = await handleSendText(cfg, svc, payload, senderName); break;
        case "send-image":    res = await handleSendImage(cfg, svc, payload, senderName); break;
        case "send-video":    res = await handleSendVideo(cfg, svc, payload, senderName); break;
        case "send-document": res = await handleSendDocument(cfg, svc, payload, senderName); break;
        case "send-audio":    res = await handleSendAudio(cfg, svc, payload, senderName); break;
        case "send-sticker":  res = await handleSendSticker(cfg, svc, payload, senderName); break;
        case "send-location": res = await handleSendLocation(cfg, svc, payload, senderName); break;
        case "send-contact":  res = await handleSendContact(cfg, svc, payload, senderName); break;
        case "send-text-status":  res = await handleSendTextStatus(cfg, svc, payload, authCheck.userId, senderName); break;
        case "send-image-status": res = await handleSendImageStatus(cfg, svc, payload, authCheck.userId, senderName); break;
        case "send-video-status": res = await handleSendVideoStatus(cfg, svc, payload, authCheck.userId, senderName); break;
        case "reply-status-text": res = await handleReplyStatusText(cfg, svc, payload, senderName); break;
        default:              res = { ok: false, status: 400, data: { error: "unknown_send_action" } };
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
