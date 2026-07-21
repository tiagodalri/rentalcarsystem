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
  is_vip: boolean;
  is_urgent: boolean;
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
  // Extras merged from search-by-content (conversations not in the initial 200)
  const [extras, setExtras] = useState<WhatsAppConversation[]>([]);

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
          load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const merged = useMemo(() => {
    if (extras.length === 0) return conversations;
    const seen = new Set(conversations.map((c) => c.id));
    return [...conversations, ...extras.filter((e) => !seen.has(e.id))];
  }, [conversations, extras]);

  return { conversations: merged, loading, error, mergeExtraConversations: setExtras };
}

export async function markConversationRead(id: string) {
  await anyClient.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", id);
}

export async function updateConversationStage(id: string, stage: FunnelStage) {
  const { error } = await anyClient
    .from("whatsapp_conversations")
    .update({ stage })
    .eq("id", id);
  if (error) throw error;
}

export async function updateConversationFlags(
  id: string,
  patch: Partial<Pick<WhatsAppConversation, "is_vip" | "is_urgent" | "status">>,
) {
  const { error } = await anyClient
    .from("whatsapp_conversations")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function fetchConversationsByIds(ids: string[]): Promise<WhatsAppConversation[]> {
  if (ids.length === 0) return [];
  const { data, error } = await anyClient
    .from("whatsapp_conversations")
    .select("*")
    .in("id", ids);
  if (error) throw error;
  return (data || []) as WhatsAppConversation[];
}

export type AssignmentFilter = "all" | "mine" | "unassigned";

export function filterConversationsByAssignment(
  conversations: WhatsAppConversation[],
  filter: AssignmentFilter,
  userId: string | null | undefined,
): WhatsAppConversation[] {
  if (filter === "all") return conversations;
  if (filter === "unassigned") return conversations.filter((c) => !c.assigned_to);
  if (filter === "mine" && userId) return conversations.filter((c) => c.assigned_to === userId);
  return conversations;
}
