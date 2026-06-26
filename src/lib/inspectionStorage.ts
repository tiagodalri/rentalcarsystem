import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const INSPECTIONS_BUCKET = "inspections";

/**
 * Accepts either:
 *  - a relative storage path (new format: "<bookingId>/<type>/<file>")
 *  - a legacy full public URL (old format: ".../object/public/inspections/<path>")
 *  - a data URL (returns as-is — used for canvas signatures)
 * Returns just the storage path, or null if value is empty / a data URL.
 */
export function extractInspectionPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("data:")) return null; // inline; not in storage
  if (value.startsWith("http://") || value.startsWith("https://")) {
    const marker = `/${INSPECTIONS_BUCKET}/`;
    const i = value.indexOf(marker);
    if (i === -1) return null;
    return value.slice(i + marker.length).split("?")[0];
  }
  return value; // already a path
}

const cache = new Map<string, { url: string; expiresAt: number }>();
const TTL_SECONDS = 3600;

export async function getSignedInspectionUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("data:")) return value; // pass through
  const path = extractInspectionPath(value);
  if (!path) return null;

  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(INSPECTIONS_BUCKET)
    .createSignedUrl(path, TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + (TTL_SECONDS - 60) * 1000 });
  return data.signedUrl;
}

/** React hook: resolves a stored value (path / legacy URL / data URL) to a usable URL. */
export function useSignedInspectionUrl(value: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    value && value.startsWith("data:") ? value : null
  );

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setUrl(null);
      return;
    }
    if (value.startsWith("data:")) {
      setUrl(value);
      return;
    }
    getSignedInspectionUrl(value).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return url;
}
