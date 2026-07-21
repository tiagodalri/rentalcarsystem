import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StaffMember {
  user_id: string;
  full_name: string;
  email: string | null;
  role: "admin" | "operations" | "support";
}

// Small in-memory cache so multiple dropdowns share one fetch per session.
let cache: StaffMember[] | null = null;
let inflight: Promise<StaffMember[]> | null = null;

async function fetchStaff(): Promise<StaffMember[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_assignable_staff");
    if (error) {
      inflight = null;
      throw error;
    }
    cache = ((data ?? []) as StaffMember[]).slice().sort((a, b) =>
      (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""),
    );
    inflight = null;
    return cache;
  })();
  return inflight;
}

export function invalidateAssignableStaff() {
  cache = null;
}

export function useAssignableStaff() {
  const [staff, setStaff] = useState<StaffMember[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStaff()
      .then((s) => {
        if (!cancelled) {
          setStaff(s);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { staff, loading, error };
}

/** Look up a staff member by id from the cached list (sync, may be undefined). */
export function useStaffLookup() {
  const { staff } = useAssignableStaff();
  return (userId: string | null | undefined): StaffMember | undefined =>
    userId ? staff.find((s) => s.user_id === userId) : undefined;
}
