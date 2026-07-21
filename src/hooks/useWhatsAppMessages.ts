import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  external_message_id: string | null;
  direction: "inbound" | "outbound";
  message_type: "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contact" | "other";
  content: string | null;
  media_url: string | null;
  media_mimetype: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  failure_reason: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  timestamp: string | null;
  created_at: string;
  pinned?: boolean;
  edited_at?: string | null;
  reply_to_message_id?: string | null;
  forwarded_from_message_id?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = supabase as unknown as { from: (t: string) => any };

export function useWhatsAppMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    async function load() {
      const { data } = await anyClient
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("timestamp", { ascending: true, nullsFirst: true })
        .limit(500);
      if (cancelled) return;
      setMessages((data || []) as WhatsAppMessage[]);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`whatsapp_messages_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return { messages, loading };
}
