import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QuickReply {
  id: string;
  title: string;
  shortcut: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = supabase as unknown as { from: (t: string) => any };

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

  const create = async (input: { title: string; shortcut?: string; content: string }) => {
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

  return { replies, loading, reload: load, create, update, remove };
}
