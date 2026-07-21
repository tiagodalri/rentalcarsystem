// Client-side helpers for WhatsApp message actions (pin, edit, react, delete-failed).
// RLS on whatsapp_messages and whatsapp_message_reactions already allows staff writes.
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = supabase as unknown as { from: (t: string) => any };

export async function togglePinMessage(messageId: string, pinned: boolean) {
  const { error } = await anyClient
    .from("whatsapp_messages")
    .update({ pinned })
    .eq("id", messageId);
  return { ok: !error, error: error?.message };
}

export async function editMessageContent(messageId: string, content: string) {
  const { error } = await anyClient
    .from("whatsapp_messages")
    .update({ content, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  return { ok: !error, error: error?.message };
}

export async function deleteFailedMessage(messageId: string) {
  const { error } = await anyClient
    .from("whatsapp_messages")
    .delete()
    .eq("id", messageId)
    .eq("status", "failed");
  return { ok: !error, error: error?.message };
}

export async function toggleReaction(messageId: string, emoji: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return { ok: false, error: "unauthenticated" };
  // check existing
  const { data: existing } = await anyClient
    .from("whatsapp_message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", uid)
    .eq("emoji", emoji)
    .maybeSingle();
  if (existing?.id) {
    const { error } = await anyClient
      .from("whatsapp_message_reactions")
      .delete()
      .eq("id", existing.id);
    return { ok: !error, removed: true, error: error?.message };
  }
  const { error } = await anyClient
    .from("whatsapp_message_reactions")
    .insert({ message_id: messageId, user_id: uid, emoji });
  return { ok: !error, removed: false, error: error?.message };
}
