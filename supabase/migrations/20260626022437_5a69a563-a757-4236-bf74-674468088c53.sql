
CREATE POLICY "Driver can view bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Driver can view customers" ON public.customers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Driver can view inspections" ON public.vehicle_inspections
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Driver can create inspections" ON public.vehicle_inspections
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'driver'::app_role));

CREATE POLICY "Driver can update own inspections" ON public.vehicle_inspections
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'driver'::app_role));
