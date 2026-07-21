import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const QUICK_REPLY_CATEGORIES = [
  "geral",
  "reserva",
  "pagamento",
  "entrega",
  "devolucao",
  "pos-venda",
] as const;

export type QuickReplyCategory = (typeof QUICK_REPLY_CATEGORIES)[number];

export interface QuickReply {
  id: string;
  title: string;
  shortcut: string | null;
  content: string;
  category: string | null;
  media_url: string | null;
  media_mimetype: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface QuickReplyInput {
  title: string;
  shortcut?: string | null;
  content: string;
  category?: string | null;
  media_url?: string | null;
  media_mimetype?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: unknown) => any };

export function useWhatsAppQuickReplies() {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await anyClient
      .from("whatsapp_quick_replies")
      .select("*")
      .order("title", { ascending: true });
    setReplies((data || []) as QuickReply[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: QuickReplyInput) => {
    const { error } = await anyClient.from("whatsapp_quick_replies").insert(input);
    if (!error) await load();
    return { error };
  };

  const update = async (id: string, patch: Partial<QuickReply>) => {
    const { error } = await anyClient.from("whatsapp_quick_replies").update(patch).eq("id", id);
    if (!error) await load();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await anyClient.from("whatsapp_quick_replies").delete().eq("id", id);
    if (!error) await load();
    return { error };
  };

  const incrementUsage = async (id: string) => {
    // Optimistic local bump
    setReplies((prev) => prev.map((r) => (r.id === id ? { ...r, usage_count: (r.usage_count ?? 0) + 1 } : r)));
    try {
      await anyClient.rpc("increment_quick_reply_usage", { p_id: id });
    } catch (e) {
      console.warn("[wa] increment_quick_reply_usage failed", e);
    }
  };

  return { replies, loading, reload: load, create, update, remove, incrementUsage };
}
