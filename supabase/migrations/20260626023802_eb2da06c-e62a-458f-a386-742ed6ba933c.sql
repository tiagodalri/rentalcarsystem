-- Diagnostic & fix: make sure Rui (driver) can upload to inspections bucket.
-- Drop and recreate INSERT policy with explicit role check tied directly to user_roles
-- (avoiding any potential issue with has_any_role evaluation inside storage RLS).

DROP POLICY IF EXISTS "Inspections staff insert" ON storage.objects;
DROP POLICY IF EXISTS "Inspections staff read"   ON storage.objects;
DROP POLICY IF EXISTS "Inspections staff update" ON storage.objects;
DROP POLICY IF EXISTS "Inspections staff delete" ON storage.objects;

CREATE POLICY "Inspections staff insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inspections'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','finance','operations','support','driver')
    )
  );

CREATE POLICY "Inspections staff read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'inspections'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','finance','operations','support','driver')
    )
  );

CREATE POLICY "Inspections staff update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'inspections'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','finance','operations','support','driver')
    )
  )
  WITH CHECK (
    bucket_id = 'inspections'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','finance','operations','support','driver')
    )
  );

CREATE POLICY "Inspections staff delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'inspections'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','finance','operations','support','driver')
    )
  );

-- Make sure user_roles is readable by authenticated for the RLS subquery above
-- (RLS on user_roles must allow the user to see their own role row).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_roles'
      AND policyname='Users can read own roles'
  ) THEN
    CREATE POLICY "Users can read own roles"
      ON public.user_roles FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
