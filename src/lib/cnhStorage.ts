import { supabase } from "@/integrations/supabase/client";

const BUCKET = "customer-licenses";

/**
 * Uploads a CNH (driver's license) file to the private customer-licenses bucket.
 * Requires an authenticated user — the storage RLS policy scopes folders to auth.uid().
 * Returns the storage path (NOT a public URL) to be saved in customers.driver_license_file_url,
 * or null if the user is not authenticated / upload failed.
 */
export async function uploadCnh(file: File): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${user.id}/cnh_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) {
    console.error("[cnhStorage] upload failed:", error);
    return null;
  }
  return path;
}

/**
 * Staff-side upload to customer-licenses. The customer-licenses bucket has a
 * "Staff can manage" ALL policy, so admins/operations/finance/support can write
 * anywhere. We namespace by the customer's user_id when available, otherwise
 * by the customer record id, so files stay grouped per person.
 */
export async function uploadCnhAsStaff(file: File, customerUserId: string | null, customerId: string): Promise<string | null> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const folder = customerUserId || `customer_${customerId}`;
  const path = `${folder}/cnh_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) {
    console.error("[cnhStorage] staff upload failed:", error);
    return null;
  }
  return path;
}

const isHttpUrl = (v: string) => /^https?:\/\//i.test(v);

/**
 * Resolves a stored CNH reference into a viewable URL.
 * - Legacy values are full public URLs (from the old `inspections` bucket) and are returned as-is.
 * - New values are private storage paths and are resolved into short-lived signed URLs (30 min).
 */
export async function getCnhViewUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  if (isHttpUrl(stored)) return stored;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(stored, 60 * 30);
  return data?.signedUrl ?? null;
}
