
-- Remove any prior public-read policies on inspections bucket (idempotent)
DROP POLICY IF EXISTS "Inspections staff read" ON storage.objects;
DROP POLICY IF EXISTS "Inspections staff insert" ON storage.objects;
DROP POLICY IF EXISTS "Inspections staff update" ON storage.objects;
DROP POLICY IF EXISTS "Inspections staff delete" ON storage.objects;

-- Staff-only read
CREATE POLICY "Inspections staff read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'inspections'
  AND public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support','driver']::app_role[])
);

-- Staff-only insert
CREATE POLICY "Inspections staff insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'inspections'
  AND public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support','driver']::app_role[])
);

-- Staff-only update
CREATE POLICY "Inspections staff update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'inspections'
  AND public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support','driver']::app_role[])
)
WITH CHECK (
  bucket_id = 'inspections'
  AND public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support','driver']::app_role[])
);

-- Admin/finance/operations delete
CREATE POLICY "Inspections staff delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'inspections'
  AND public.has_any_role(auth.uid(), ARRAY['admin','finance','operations']::app_role[])
);
