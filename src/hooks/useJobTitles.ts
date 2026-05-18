import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type JobTitle = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

let cache: JobTitle[] | null = null;
const listeners = new Set<() => void>();

async function fetchJobTitles(includeInactive = false): Promise<JobTitle[]> {
  let q = supabase.from("job_titles").select("*").order("sort_order").order("name");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data } = await q;
  return (data || []) as JobTitle[];
}

export function useJobTitles(includeInactive = false) {
  const [items, setItems] = useState<JobTitle[]>(cache || []);
  const [loading, setLoading] = useState(!cache);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchJobTitles(includeInactive);
    if (!includeInactive) {
      cache = data;
      listeners.forEach((l) => l());
    }
    setItems(data);
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    if (!cache || includeInactive) load();
    const listener = () => { if (cache && !includeInactive) setItems(cache); };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [load, includeInactive]);

  const refresh = useCallback(async () => {
    cache = null;
    await load();
  }, [load]);

  return { jobTitles: items, loading, refresh };
}
