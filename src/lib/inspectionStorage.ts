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
const localPreviewListeners = new Map<string, Set<(url: string) => void>>();
const TTL_SECONDS = 3600;

function notifyLocalPreview(path: string, url: string) {
  localPreviewListeners.get(path)?.forEach((listener) => listener(url));
}

/** Register a local blob preview for a freshly uploaded file, keyed by its storage path. */
export function registerLocalInspectionPreview(path: string, file: File | Blob): string {
  const url = URL.createObjectURL(file);
  const prev = localPreviews.get(path);
  if (prev) URL.revokeObjectURL(prev);
  localPreviews.set(path, url);
  notifyLocalPreview(path, url);
  return url;
}

export function getLocalInspectionPreview(value: string | null | undefined): string | null {
  const path = extractInspectionPath(value);
  return path ? localPreviews.get(path) || null : null;
}

export function subscribeLocalInspectionPreview(
  value: string | null | undefined,
  listener: (url: string) => void,
): () => void {
  const path = extractInspectionPath(value);
  if (!path) return () => undefined;

  const listeners = localPreviewListeners.get(path) || new Set<(url: string) => void>();
  listeners.add(listener);
  localPreviewListeners.set(path, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) localPreviewListeners.delete(path);
  };
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
    value && (value.startsWith("data:") || value.startsWith("blob:"))
      ? value
      : getLocalInspectionPreview(value)
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
    const unsubscribe = subscribeLocalInspectionPreview(value, (nextUrl) => {
      if (!cancelled) setUrl(nextUrl);
    });
    const local = getLocalInspectionPreview(value);
    if (local) {
      setUrl(local);
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }
    getSignedInspectionUrl(value).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
      unsubscribe();
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
  maxDim = 1280,
  quality = 0.68,
): Promise<Blob> {
  try {
    if (!file.type.startsWith("image/")) return file;
    // Already small enough — skip work.
    if (file.size < 350 * 1024) return file;

    const orientation = file.type === "image/jpeg" ? await readJpegOrientation(file) : 1;
    const bitmap = await createImageBitmap(file, { imageOrientation: "none" }).catch(() =>
      createImageBitmap(file).catch(() => null)
    );
    if (!bitmap) return file;

    const swapsAxes = orientation >= 5 && orientation <= 8;
    const orientedWidth = swapsAxes ? bitmap.height : bitmap.width;
    const orientedHeight = swapsAxes ? bitmap.width : bitmap.height;
    const longest = Math.max(orientedWidth, orientedHeight);
    const scale = longest > maxDim ? maxDim / longest : 1;
    const drawWidth = Math.round(bitmap.width * scale);
    const drawHeight = Math.round(bitmap.height * scale);
    const canvasWidth = Math.round(orientedWidth * scale);
    const canvasHeight = Math.round(orientedHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    applyExifOrientationTransform(ctx, orientation, canvasWidth, canvasHeight);
    ctx.drawImage(bitmap, 0, 0, drawWidth, drawHeight);
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

async function readJpegOrientation(file: File): Promise<number> {
  try {
    const buffer = await file.slice(0, 64 * 1024).arrayBuffer();
    const view = new DataView(buffer);
    if (view.getUint16(0, false) !== 0xffd8) return 1;

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      const size = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1 && offset + 6 < view.byteLength) {
        const exif = String.fromCharCode(
          view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2),
          view.getUint8(offset + 3), view.getUint8(offset + 4), view.getUint8(offset + 5),
        );
        if (exif !== "Exif\0\0") return 1;
        const tiffOffset = offset + 6;
        const little = view.getUint16(tiffOffset, false) === 0x4949;
        const firstIfdOffset = view.getUint32(tiffOffset + 4, little);
        const ifdOffset = tiffOffset + firstIfdOffset;
        const entries = view.getUint16(ifdOffset, little);
        for (let i = 0; i < entries; i += 1) {
          const entryOffset = ifdOffset + 2 + i * 12;
          if (entryOffset + 10 >= view.byteLength) break;
          if (view.getUint16(entryOffset, little) === 0x0112) {
            const orientation = view.getUint16(entryOffset + 8, little);
            return orientation >= 1 && orientation <= 8 ? orientation : 1;
          }
        }
        return 1;
      }
      offset += size - 2;
    }
  } catch {
    return 1;
  }
  return 1;
}

function applyExifOrientationTransform(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number,
) {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, width, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, width, height);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, height);
      break;
  }
}

