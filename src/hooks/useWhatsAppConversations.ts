import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FunnelStage =
  | "novo_lead"
  | "atendimento"
  | "proposta_enviada"
  | "negociacao"
  | "reserva_confirmada"
  | "perdido";

export interface WhatsAppConversation {
  id: string;
  phone: string;
  external_conversation_id: string | null;
  contact_name: string | null;
  customer_id: string | null;
  is_group: boolean;
  status: "open" | "archived";
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  assigned_to: string | null;
  stage: FunnelStage;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const anyClient = supabase as unknown as {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export function useWhatsAppConversations() {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error: qErr } = await anyClient
        .from("whatsapp_conversations")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (cancelled) return;
      if (qErr) setError(qErr.message);
      setConversations((data || []) as WhatsAppConversation[]);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel("whatsapp_conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        () => {
          // Simple refresh strategy; volume is low for an inbox
          load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { conversations, loading, error };
}

export async function markConversationRead(id: string) {
  await anyClient.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", id);
}
