import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = supabase as unknown as { from: (t: string) => any };

/**
 * Loads reactions for all messages of a conversation with realtime updates.
 * Filter is a subquery via message_id in message ids of the conversation.
 * We load all reactions where message_id in (messageIds).
 */
export function useMessageReactions(conversationId: string | null, messageIds: string[]) {
  const [reactions, setReactions] = useState<WhatsAppReaction[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const idsKey = messageIds.join(",");

  useEffect(() => {
    if (!conversationId || messageIds.length === 0) {
      setReactions([]);
      return;
    }
    let cancelled = false;

    async function load() {
      const { data } = await anyClient
        .from("whatsapp_message_reactions")
        .select("*")
        .in("message_id", messageIds);
      if (cancelled) return;
      setReactions((data || []) as WhatsAppReaction[]);
    }
    load();

    const channel = supabase
      .channel(`wa_reactions_${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_message_reactions" },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, idsKey]);

  const byMessage = useMemo(() => {
    const map = new Map<string, WhatsAppReaction[]>();
    for (const r of reactions) {
      const arr = map.get(r.message_id) || [];
      arr.push(r);
      map.set(r.message_id, arr);
    }
    return map;
  }, [reactions]);

  return { reactions, byMessage, currentUserId };
}
