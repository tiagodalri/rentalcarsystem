// send-scheduled-messages
// Called every minute by pg_cron. Claims pending scheduled messages whose
// scheduled_for has arrived, sends each via Z-API (using shared helpers), and
// updates the row status to 'sent' or 'failed'.
//
// Auth: this function is server-to-server only. We rely on a shared secret
// header. IMPORTANT: the header name here MUST match the header name the cron
// job sends (see migration). Both use `x-scheduled-secret`.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { callZapi, readZapiConfigAsync, normalizePhone } from "../_shared/zapi.ts";
import { recordOutboundMessage } from "../_shared/whatsappRecord.ts";

const HEADER_NAME = "x-scheduled-secret";

async function readScheduledSecret(): Promise<string | null> {
  // Prefer the vault secret (single source of truth shared with pg_cron).
  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await svc.rpc("get_scheduled_messages_secret");
    if (!error && typeof data === "string" && data.length > 0) return data;
  } catch (_) {
    /* fall through */
  }
  return Deno.env.get("SCHEDULED_MESSAGES_SECRET") ?? null;
}

interface ScheduledRow {
  id: string;
  conversation_id: string;
  content: string | null;
  media_url: string | null;
  media_mimetype: string | null;
  message_type: string;
  scheduled_for: string;
  status: string;
  created_by: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");

  const provided = req.headers.get(HEADER_NAME) ?? "";
  const expected = (await readScheduledSecret()) ?? "";
  if (!expected || provided !== expected) {
    console.warn("[send-scheduled-messages] unauthorized invocation");
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Atomically reserve a batch of due messages.
  const { data: claimed, error: claimErr } = await svc.rpc(
    "claim_scheduled_messages",
    { p_limit: 20 },
  );
  if (claimErr) {
    console.error("[send-scheduled-messages] claim failed", claimErr);
    return new Response(JSON.stringify({ ok: false, error: claimErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = (claimed ?? []) as ScheduledRow[];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const cfg = await readZapiConfigAsync();
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const row of rows) {
    try {
      // Look up the conversation phone
      const { data: conv } = await svc
        .from("whatsapp_conversations")
        .select("phone")
        .eq("id", row.conversation_id)
        .maybeSingle();

      const phone = normalizePhone((conv as { phone?: string } | null)?.phone ?? "");
      const content = row.content ?? "";
      if (!phone || !content) {
        await svc.from("scheduled_messages").update({
          status: "failed",
          failure_reason: !phone ? "conversation_not_found" : "empty_content",
        }).eq("id", row.id);
        results.push({ id: row.id, ok: false, error: "missing_fields" });
        continue;
      }

      let externalId = `sched-${crypto.randomUUID()}`;
      let ok = false;
      let failureReason: string | null = null;

      if (!cfg) {
        // Demo mode: no Z-API configured, still record message as sent so the
        // customer-facing thread reflects delivery in the UI.
        ok = true;
      } else {
        const res = await callZapi(cfg, "/send-text", {
          method: "POST",
          body: JSON.stringify({ phone, message: content }),
        });
        if (res.ok) {
          const d = (res.data ?? {}) as { messageId?: string; zaapId?: string };
          externalId = d.messageId || d.zaapId || externalId;
          ok = true;
        } else {
          failureReason =
            res.reason === "device_offline"
              ? "device_offline"
              : `zapi_error_${res.status}`;
        }
      }

      if (ok) {
        await recordOutboundMessage(svc, {
          conversationId: row.conversation_id,
          phone,
          content,
          externalId,
          status: "sent",
          messageType: "text",
          senderName: "GoDalz",
        });
        await svc.from("scheduled_messages").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          failure_reason: null,
        }).eq("id", row.id);
        results.push({ id: row.id, ok: true });
      } else {
        await svc.from("scheduled_messages").update({
          status: "failed",
          failure_reason: failureReason ?? "unknown_error",
        }).eq("id", row.id);
        results.push({ id: row.id, ok: false, error: failureReason ?? "unknown_error" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[send-scheduled-messages] row failed", row.id, msg);
      await svc.from("scheduled_messages").update({
        status: "failed",
        failure_reason: msg.slice(0, 500),
      }).eq("id", row.id);
      results.push({ id: row.id, ok: false, error: msg });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: rows.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
