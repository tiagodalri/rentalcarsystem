import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PresenceStatus = "composing" | "recording" | null;

interface PresenceRow {
  phone: string;
  status: string;
  updated_at: string;
}

interface PresenceEntry {
  status: string;
  updated_at: string;
}

const EXPIRE_MS = 30_000;
const CLEANUP_INTERVAL_MS = 5_000;

function normalizeDigits(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

function mapStatus(raw: string): PresenceStatus {
  const s = (raw || "").toUpperCase();
  if (s === "COMPOSING" || s === "TYPING") return "composing";
  if (s === "RECORDING") return "recording";
  return null;
}

/**
 * Live presence map keyed by phone digits.
 * - Subscribes once to postgres_changes on public.chat_presence.
 * - Auto-expires entries older than 30s (Z-API doesn't guarantee cleanup events).
 */
export function usePresenceByPhone() {
  const [byPhone, setByPhone] = useState<Record<string, PresenceEntry>>({});
  const byPhoneRef = useRef(byPhone);
  byPhoneRef.current = byPhone;

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("chat_presence")
        .select("phone, status, updated_at")
        .gte("updated_at", new Date(Date.now() - EXPIRE_MS).toISOString());
      if (cancelled || !data) return;
      const next: Record<string, PresenceEntry> = {};
      for (const r of data as PresenceRow[]) {
        next[normalizeDigits(r.phone)] = { status: r.status, updated_at: r.updated_at };
      }
      setByPhone(next);
    }
    loadInitial();

    const channel = supabase
      .channel("chat-presence-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_presence" },
        (payload) => {
          const row = (payload.new || payload.old) as PresenceRow | null;
          if (!row?.phone) return;
          const key = normalizeDigits(row.phone);
          if (payload.eventType === "DELETE") {
            setByPhone((prev) => {
              if (!(key in prev)) return prev;
              const { [key]: _drop, ...rest } = prev;
              return rest;
            });
            return;
          }
          setByPhone((prev) => ({
            ...prev,
            [key]: { status: row.status, updated_at: row.updated_at },
          }));
        },
      )
      .subscribe();

    const timer = setInterval(() => {
      const cutoff = Date.now() - EXPIRE_MS;
      const current = byPhoneRef.current;
      let changed = false;
      const next: Record<string, PresenceEntry> = {};
      for (const [k, v] of Object.entries(current)) {
        if (new Date(v.updated_at).getTime() >= cutoff) {
          next[k] = v;
        } else {
          changed = true;
        }
      }
      if (changed) setByPhone(next);
    }, CLEANUP_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  const getActivePresence = useCallback(
    (phone: string): PresenceStatus => {
      const key = normalizeDigits(phone);
      const entry = byPhone[key];
      if (!entry) return null;
      if (Date.now() - new Date(entry.updated_at).getTime() > EXPIRE_MS) return null;
      return mapStatus(entry.status);
    },
    [byPhone],
  );

  return { byPhone, getActivePresence };
}

export type UsePresenceByPhoneReturn = ReturnType<typeof usePresenceByPhone>;
