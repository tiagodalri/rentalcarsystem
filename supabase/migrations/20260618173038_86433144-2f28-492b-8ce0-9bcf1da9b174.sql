
-- 1. Fix bouncie_backfill_progress RLS
DROP POLICY IF EXISTS "Authenticated can read bouncie_backfill_progress" ON public.bouncie_backfill_progress;
DROP POLICY IF EXISTS "Authenticated can manage bouncie_backfill_progress" ON public.bouncie_backfill_progress;
DROP POLICY IF EXISTS "Authenticated users can view bouncie_backfill_progress" ON public.bouncie_backfill_progress;
DROP POLICY IF EXISTS "Authenticated users can manage bouncie_backfill_progress" ON public.bouncie_backfill_progress;

CREATE POLICY "Internal staff can read bouncie_backfill_progress"
  ON public.bouncie_backfill_progress FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','finance','support']::app_role[]));

CREATE POLICY "Internal staff can manage bouncie_backfill_progress"
  ON public.bouncie_backfill_progress FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','finance','support']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations','finance','support']::app_role[]));

-- 2. Storage policies for customer-licenses bucket
DROP POLICY IF EXISTS "Customer can read own license" ON storage.objects;
DROP POLICY IF EXISTS "Customer can upload own license" ON storage.objects;
DROP POLICY IF EXISTS "Customer can update own license" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read all customer licenses" ON storage.objects;
DROP POLICY IF EXISTS "Staff can manage customer licenses" ON storage.objects;

CREATE POLICY "Customer can read own license"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'customer-licenses'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Customer can upload own license"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'customer-licenses'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Customer can update own license"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'customer-licenses'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Staff can read all customer licenses"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'customer-licenses'
    AND public.has_any_role(auth.uid(), ARRAY['admin','operations','finance','support']::app_role[])
  );

CREATE POLICY "Staff can manage customer licenses"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'customer-licenses'
    AND public.has_any_role(auth.uid(), ARRAY['admin','operations','finance','support']::app_role[])
  )
  WITH CHECK (
    bucket_id = 'customer-licenses'
    AND public.has_any_role(auth.uid(), ARRAY['admin','operations','finance','support']::app_role[])
  );

-- 3. Realtime channel policies — restrict vehicle telemetry broadcasts to internal staff
DROP POLICY IF EXISTS "Staff can receive vehicle telemetry broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;

CREATE POLICY "Staff can receive vehicle telemetry broadcasts"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'vehicle-telemetry%'
        OR realtime.topic() LIKE 'fleet-live%'
        OR realtime.topic() LIKE 'trip-events%'
      THEN public.has_any_role(auth.uid(), ARRAY['admin','operations','finance','support']::app_role[])
      ELSE true
    END
  );
