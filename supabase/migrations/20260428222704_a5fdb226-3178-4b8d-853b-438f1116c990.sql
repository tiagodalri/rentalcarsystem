CREATE POLICY "Customers can upload own license files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inspections'
  AND (storage.foldername(name))[1] = 'licenses'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Customers can view own license files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'inspections'
  AND (storage.foldername(name))[1] = 'licenses'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Customers can update own license files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'inspections'
  AND (storage.foldername(name))[1] = 'licenses'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'inspections'
  AND (storage.foldername(name))[1] = 'licenses'
  AND (storage.foldername(name))[2] = auth.uid()::text
);