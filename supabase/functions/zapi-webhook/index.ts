import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  externalConversationId,
  normalizePhone,
  readWebhookSecretAsync,
  timingSafeEqual,
} from "../_shared/zapi.ts";

// Public endpoint: no user JWT, authenticated by ?token= query param
// compared against ZAPI_WEBHOOK_SECRET in constant time.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

interface AnyRecord {
  [k: string]: unknown;
}

function pickString(o: AnyRecord, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function detectMessageType(payload: AnyRecord): {
  type: "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "other";
  content?: string;
  mediaUrl?: string;
  mediaMime?: string;
} {
  if (payload.text && typeof payload.text === "object") {
    return { type: "text", content: pickString(payload.text as AnyRecord, "message") };
  }
  if (payload.image && typeof payload.image === "object") {
    const img = payload.image as AnyRecord;
    return {
      type: "image",
      content: pickString(img, "caption"),
      mediaUrl: pickString(img, "imageUrl", "url"),
      mediaMime: pickString(img, "mimeType"),
    };
  }
  if (payload.audio && typeof payload.audio === "object") {
    const a = payload.audio as AnyRecord;
    return { type: "audio", mediaUrl: pickString(a, "audioUrl", "url"), mediaMime: pickString(a, "mimeType") };
  }
  if (payload.video && typeof payload.video === "object") {
    const v = payload.video as AnyRecord;
    return {
      type: "video",
      content: pickString(v, "caption"),
      mediaUrl: pickString(v, "videoUrl", "url"),
      mediaMime: pickString(v, "mimeType"),
    };
  }
  if (payload.document && typeof payload.document === "object") {
    const d = payload.document as AnyRecord;
    return {
      type: "document",
      content: pickString(d, "fileName", "caption"),
      mediaUrl: pickString(d, "documentUrl", "url"),
      mediaMime: pickString(d, "mimeType"),
    };
  }
  if (payload.sticker) return { type: "sticker" };
  if (payload.location) return { type: "location" };
  return { type: "other" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const secret = await readWebhookSecretAsync();
  if (!secret) {
    // Accept the request but do nothing — avoids leaking configuration state to callers
    return json({ ok: false, reason: "not_configured" });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!timingSafeEqual(token, secret)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: AnyRecord;
  try {
    payload = (await req.json()) as AnyRecord;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const eventType = pickString(payload, "type");
  const externalMessageId = pickString(payload, "messageId", "ids");
  const phone = normalizePhone(pickString(payload, "phone", "chatId") || "");

  // -------- PresenceChatCallback: high-frequency, does NOT enter raw log --------
  if (eventType === "PresenceChatCallback") {
    if (!phone) return json({ ok: true, type: "presence", skipped: "missing_phone" });
    const status = (pickString(payload, "status") || "AVAILABLE").toUpperCase();
    try {
      await supabase
        .from("chat_presence")
        .upsert(
          { phone, status, updated_at: new Date().toISOString() },
          { onConflict: "phone" },
        );
    } catch (err) {
      console.warn("[zapi-webhook] chat_presence upsert failed", err);
    }
    return json({ ok: true, type: "presence" });
  }

  // 1) Always persist the raw payload first (zero-loss)
  let rawId: string | null = null;
  try {
    const { data: raw } = await supabase
      .from("whatsapp_events_raw")
      .insert({
        event_type: eventType || null,
        external_message_id: externalMessageId || null,
        phone: phone || null,
        payload,
      })
      .select("id")
      .single();
    rawId = (raw as { id: string } | null)?.id ?? null;
  } catch (err) {
    console.error("[zapi-webhook] failed to persist raw payload", err);
    // still respond 200 so Z-API doesn't retry-storm
    return json({ ok: false, error: "raw_insert_failed" });
  }

  async function markProcessed(error?: string) {
    if (!rawId) return;
    await supabase
      .from("whatsapp_events_raw")
      .update({ processed: !error, error: error ?? null })
      .eq("id", rawId);
  }

  try {
    // 2) Route by event type
    switch (eventType) {
      case "ConnectedCallback":
      case "DisconnectedCallback": {
        const status = eventType === "ConnectedCallback" ? "connected" : "disconnected";
        // singleton row updated by latest
        const { data: existing } = await supabase
          .from("whatsapp_connection_status")
          .select("id")
          .limit(1)
          .maybeSingle();
        const patch: Record<string, unknown> = {
          status,
          last_heartbeat_at: new Date().toISOString(),
          last_checked_at: new Date().toISOString(),
          connected_phone: status === "connected" ? phone || null : null,
        };
        if (existing?.id) {
          await supabase.from("whatsapp_connection_status").update(patch).eq("id", existing.id);
        } else {
          await supabase.from("whatsapp_connection_status").insert(patch);
        }
        await markProcessed();
        return json({ ok: true });
      }

      case "MessageStatusCallback": {
        const rawStatus = (pickString(payload, "status") || "").toUpperCase();
        const map: Record<string, string> = {
          SENT: "sent",
          RECEIVED: "delivered",
          DELIVERY_ACK: "delivered",
          READ: "read",
          PLAYED: "read",
        };
        const mapped = map[rawStatus];
        if (mapped && externalMessageId) {
          await supabase
            .from("whatsapp_messages")
            .update({ status: mapped })
            .eq("external_message_id", externalMessageId);
        }
        await markProcessed();
        return json({ ok: true });
      }

      case "ReceivedCallback":
      default: {
        // Treat missing type as incoming message when text/media/phone are present
        if (!phone) {
          await markProcessed("missing_phone");
          return json({ ok: true, skipped: "missing_phone" });
        }

        const fromMe = payload.fromMe === true;
        const isGroup = payload.isGroup === true;
        const chatName = pickString(payload, "chatName");
        const senderName = pickString(payload, "senderName") || chatName;
        const detected = detectMessageType(payload);

        // upsert conversation
        const { data: convExisting } = await supabase
          .from("whatsapp_conversations")
          .select("id, unread_count, customer_id")
          .eq("phone", phone)
          .maybeSingle();

        // Match customer by last 10 digits of phone via SECURITY DEFINER RPC.
        // Filters at the DB with a normalized suffix, so it works regardless of
        // the format stored in customers.phone (with/without DDI, formatting).
        let customerId: string | null = convExisting?.customer_id ?? null;
        if (!customerId && phone.length >= 10) {
          const { data: matchedId } = await supabase.rpc(
            "find_customer_by_phone_digits",
            { p_digits: phone },
          );
          if (typeof matchedId === "string") customerId = matchedId;
        }

        const preview =
          detected.content ||
          (detected.type === "text" ? "" : `[${detected.type}]`);
        const nowIso = new Date().toISOString();

        let conversationId: string;
        if (convExisting?.id) {
          conversationId = convExisting.id;
          await supabase
            .from("whatsapp_conversations")
            .update({
              contact_name: senderName || null,
              is_group: isGroup,
              customer_id: customerId,
              last_message_at: nowIso,
              last_message_preview: preview.slice(0, 240),
              unread_count: fromMe ? convExisting.unread_count : (convExisting.unread_count || 0) + 1,
              external_conversation_id: externalConversationId(phone),
            })
            .eq("id", conversationId);
        } else {
          const { data: convNew } = await supabase
            .from("whatsapp_conversations")
            .insert({
              phone,
              external_conversation_id: externalConversationId(phone),
              contact_name: senderName || null,
              customer_id: customerId,
              is_group: isGroup,
              last_message_at: nowIso,
              last_message_preview: preview.slice(0, 240),
              unread_count: fromMe ? 0 : 1,
            })
            .select("id")
            .single();
          conversationId = (convNew as { id: string }).id;
        }

        // insert message with idempotency
        const momentTs = typeof payload.momment === "number"
          ? new Date(payload.momment).toISOString()
          : nowIso;

        const { error: insertErr } = await supabase.from("whatsapp_messages").insert({
          conversation_id: conversationId,
          external_message_id: externalMessageId || null,
          direction: fromMe ? "outbound" : "inbound",
          message_type: detected.type,
          content: detected.content || null,
          media_url: detected.mediaUrl || null,
          media_mimetype: detected.mediaMime || null,
          status: fromMe ? "sent" : "delivered",
          sender_name: senderName || null,
          sender_phone: phone,
          raw_payload: payload,
          timestamp: momentTs,
        });

        // Postgres unique_violation (23505) = idempotent duplicate; treat as success
        if (insertErr && (insertErr as { code?: string }).code !== "23505") {
          await markProcessed(insertErr.message);
          return json({ ok: false, error: insertErr.message });
        }

        await markProcessed();
        return json({ ok: true });
      }
    }
  } catch (err) {
    console.error("[zapi-webhook] processing error", err);
    await markProcessed(err instanceof Error ? err.message : String(err));
    return json({ ok: false });
  }
});
