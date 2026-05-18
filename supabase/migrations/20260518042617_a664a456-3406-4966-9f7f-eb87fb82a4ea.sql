
-- 1. Add CNH verification columns to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS driver_license_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS driver_license_verified_by uuid NULL;

-- 2. Create private bucket for customer documents (CNH etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-documents', 'customer-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies on storage.objects for the new bucket
-- Path pattern: {user_id}/cnh.{ext}  -> first folder is owner's user_id
CREATE POLICY "customer-documents owner select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'customer-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'support'::app_role])
  )
);

CREATE POLICY "customer-documents owner insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'customer-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'support'::app_role])
  )
);

CREATE POLICY "customer-documents owner update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'customer-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'support'::app_role])
  )
);

CREATE POLICY "customer-documents owner delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'customer-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'support'::app_role])
  )
);
