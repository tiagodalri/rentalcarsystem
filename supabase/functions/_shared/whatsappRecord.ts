// Shared WhatsApp DB recording helpers.
// Used by both zapi-proxy (client-triggered sends) and
// send-scheduled-messages (cron-triggered sends). Keeps the DB write path
// consistent — the Z-API call itself lives in _shared/zapi.ts.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { normalizePhone } from "./zapi.ts";

export interface RecordOutboundInput {
  conversationId?: string | null;
  phone: string;
  content: string;
  externalId: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  messageType?:
    | "text" | "image" | "audio" | "video"
    | "document" | "sticker" | "location" | "contact";
  mediaUrl?: string | null;
  mediaMimetype?: string | null;
  senderName?: string | null;
  replyToMessageId?: string | null;
  forwardedFromMessageId?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  locationLabel?: string | null;
}

export async function ensureConversation(
  svc: SupabaseClient,
  phone: string,
): Promise<string | null> {
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

export async function recordOutboundMessage(
  svc: SupabaseClient,
  input: RecordOutboundInput,
): Promise<string | null> {
  try {
    let convId = input.conversationId ?? null;
    if (!convId) convId = await ensureConversation(svc, input.phone);
    if (!convId) return null;

    const now = new Date().toISOString();
    const messageType = input.messageType ?? "text";
    const preview =
      messageType === "text" ? (input.content || "").slice(0, 120)
      : messageType === "image" ? "[imagem]"
      : messageType === "video" ? "[vídeo]"
      : messageType === "audio" ? "[áudio]"
      : messageType === "sticker" ? "[figurinha]"
      : messageType === "location" ? `[localização] ${input.locationLabel || ""}`.trim()
      : messageType === "contact" ? `[contato] ${input.content || ""}`.trim()
      : messageType === "document" ? `[documento] ${input.content || ""}`.trim()
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
      reply_to_message_id: input.replyToMessageId ?? null,
      forwarded_from_message_id: input.forwardedFromMessageId ?? null,
      location_lat: input.locationLat ?? null,
      location_lng: input.locationLng ?? null,
      location_label: input.locationLabel ?? null,
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
    console.error("[whatsappRecord] recordOutboundMessage failed", err);
    return null;
  }
}
