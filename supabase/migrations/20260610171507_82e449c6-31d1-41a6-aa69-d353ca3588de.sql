
-- ============================================================
-- 1) PRICING TABLES: restrict writes to admin/operations
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can manage price overrides" ON public.vehicle_price_overrides;
DROP POLICY IF EXISTS "Authenticated can manage price seasons"  ON public.vehicle_price_seasons;
DROP POLICY IF EXISTS "Authenticated can manage pricing rules"  ON public.vehicle_pricing_rules;

CREATE POLICY "Staff can manage price overrides"
  ON public.vehicle_price_overrides FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]));

CREATE POLICY "Staff can manage price seasons"
  ON public.vehicle_price_seasons FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]));

CREATE POLICY "Staff can manage pricing rules"
  ON public.vehicle_pricing_rules FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]));

-- ============================================================
-- 2) VEHICLE DOCUMENTS table: staff-only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view vehicle documents"   ON public.vehicle_documents;
DROP POLICY IF EXISTS "Authenticated can insert vehicle documents" ON public.vehicle_documents;
DROP POLICY IF EXISTS "Authenticated can update vehicle documents" ON public.vehicle_documents;
DROP POLICY IF EXISTS "Authenticated can delete vehicle documents" ON public.vehicle_documents;

CREATE POLICY "Staff can view vehicle documents"
  ON public.vehicle_documents FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]));
CREATE POLICY "Staff can insert vehicle documents"
  ON public.vehicle_documents FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]));
CREATE POLICY "Staff can update vehicle documents"
  ON public.vehicle_documents FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]));
CREATE POLICY "Staff can delete vehicle documents"
  ON public.vehicle_documents FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]));

-- ============================================================
-- 3) VEHICLE-DOCUMENTS STORAGE BUCKET: staff-only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated read vehicle-documents bucket"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload vehicle-documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update vehicle-documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete vehicle-documents bucket" ON storage.objects;

CREATE POLICY "Staff read vehicle-documents bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='vehicle-documents' AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]));
CREATE POLICY "Staff upload vehicle-documents bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='vehicle-documents' AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]));
CREATE POLICY "Staff update vehicle-documents bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='vehicle-documents' AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]))
  WITH CHECK (bucket_id='vehicle-documents' AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]));
CREATE POLICY "Staff delete vehicle-documents bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='vehicle-documents' AND has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role]));

-- ============================================================
-- 4) TELEMETRY & TRIPS: staff-only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view telemetry"          ON public.vehicle_telemetry;
DROP POLICY IF EXISTS "Authenticated can view telemetry history"  ON public.vehicle_telemetry_history;
DROP POLICY IF EXISTS "Authenticated can view trips"              ON public.vehicle_trips;
DROP POLICY IF EXISTS "trip_events readable by authenticated"     ON public.trip_events;

CREATE POLICY "Staff can view telemetry"
  ON public.vehicle_telemetry FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role,'finance'::app_role,'support'::app_role]));
CREATE POLICY "Staff can view telemetry history"
  ON public.vehicle_telemetry_history FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role,'finance'::app_role,'support'::app_role]));
CREATE POLICY "Staff can view trips"
  ON public.vehicle_trips FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role,'finance'::app_role,'support'::app_role]));
CREATE POLICY "Staff can read trip events"
  ON public.trip_events FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role,'finance'::app_role,'support'::app_role]));

-- ============================================================
-- 5) VEHICLES TABLE: hide sensitive columns from anon
-- ============================================================
REVOKE SELECT ON public.vehicles FROM anon;
GRANT SELECT (
  id, name, category, daily_price_usd, passengers, bags, transmission, fuel,
  year, status, features, image_url, published, photos, brand, model,
  model_year, color, doors, default_deposit_amount, default_franchise_amount,
  deleted_at, created_at, updated_at, notes
) ON public.vehicles TO anon;

-- ============================================================
-- 6) Revoke SECURITY DEFINER helpers from anon
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.get_occupancy_rate()         FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_last_login()          FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)     FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM anon;
