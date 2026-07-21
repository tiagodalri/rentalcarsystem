import { supabase } from "@/integrations/supabase/client";

const BUCKET = "whatsapp-media";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function extFromName(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return (m ? m[1] : "bin").toLowerCase();
}

export interface UploadedMedia {
  path: string;
  signedUrl: string;
  mimeType: string;
  fileName: string;
  extension: string;
}

/** Upload a file to the whatsapp-media private bucket and return a signed URL. */
export async function uploadWhatsAppMedia(file: File): Promise<UploadedMedia> {
  const safe = sanitizeFileName(file.name || `file-${Date.now()}`);
  const path = `outbound/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safe}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data, error: urlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (urlErr || !data?.signedUrl) throw urlErr ?? new Error("failed_to_sign_url");

  return {
    path,
    signedUrl: data.signedUrl,
    mimeType: file.type || "application/octet-stream",
    fileName: safe,
    extension: extFromName(safe),
  };
}
