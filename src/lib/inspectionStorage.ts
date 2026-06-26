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
const localPreviews = new Map<string, string>(); // path -> blob: URL (immediate preview after upload)
const TTL_SECONDS = 3600;

/** Register a local blob preview for a freshly uploaded file, keyed by its storage path. */
export function registerLocalInspectionPreview(path: string, file: File | Blob): string {
  const url = URL.createObjectURL(file);
  const prev = localPreviews.get(path);
  if (prev) URL.revokeObjectURL(prev);
  localPreviews.set(path, url);
  return url;
}

export async function getSignedInspectionUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("data:") || value.startsWith("blob:")) return value;
  const path = extractInspectionPath(value);
  if (!path) return null;

  const local = localPreviews.get(path);
  if (local) return local;

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
    value && (value.startsWith("data:") || value.startsWith("blob:")) ? value : null
  );

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setUrl(null);
      return;
    }
    if (value.startsWith("data:") || value.startsWith("blob:")) {
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

/**
 * Client-side image compression. Reduces large phone photos (3-6 MB) to ~200-400 KB
 * JPEGs at <=1600px on the long edge, making uploads dramatically faster on mobile.
 * Falls back to the original file if anything goes wrong (HEIC, no canvas, etc).
 */
export async function compressInspectionImage(
  file: File,
  maxDim = 1600,
  quality = 0.78,
): Promise<Blob> {
  try {
    if (!file.type.startsWith("image/")) return file;
    // Already small enough — skip work.
    if (file.size < 350 * 1024) return file;

    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;

    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxDim ? maxDim / longest : 1;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
    if (!blob) return file;
    // Safety: if compression somehow made it bigger, keep original.
    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

