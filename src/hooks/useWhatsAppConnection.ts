import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WhatsAppStatus = "disconnected" | "connecting" | "connected";

export interface WhatsAppConnectionRow {
  id: string;
  status: WhatsAppStatus;
  connected_phone: string | null;
  last_heartbeat_at: string | null;
  last_checked_at: string | null;
  updated_at: string;
}

export function useWhatsAppConnection() {
  const [connection, setConnection] = useState<WhatsAppConnectionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Types not regenerated yet for new tables; cast supabase to any locally.
      const { data, error: qErr } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => { limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> } };
          };
        };
      })
        .from("whatsapp_connection_status")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (qErr) setError(qErr.message);
      setConnection((data as WhatsAppConnectionRow | null) ?? null);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel("whatsapp_connection_status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_connection_status" },
        (payload) => {
          const row = (payload.new || payload.old) as WhatsAppConnectionRow | null;
          if (row) setConnection(row);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { connection, loading, error };
}
