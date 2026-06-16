
CREATE INDEX IF NOT EXISTS idx_bookings_contract_status ON public.bookings (contract_status) WHERE deleted_at IS NULL;

-- Storage policies for signed-contracts bucket (private)
DROP POLICY IF EXISTS "Admins read signed contracts" ON storage.objects;
CREATE POLICY "Admins read signed contracts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signed-contracts'
    AND public.has_any_role(auth.uid(), ARRAY['admin','operations','finance','support']::app_role[])
  );

DROP POLICY IF EXISTS "Customers read their own signed contract" ON storage.objects;
CREATE POLICY "Customers read their own signed contract"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signed-contracts'
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.customers c ON c.id = b.customer_id
      WHERE c.user_id = auth.uid()
        AND (storage.foldername(name))[1] = b.id::text
    )
  );

DROP POLICY IF EXISTS "Service role manages signed contracts" ON storage.objects;
CREATE POLICY "Service role manages signed contracts"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'signed-contracts')
  WITH CHECK (bucket_id = 'signed-contracts');
