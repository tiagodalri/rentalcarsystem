DROP POLICY IF EXISTS "Admin and operations can manage vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Finance can view vehicles" ON public.vehicles;

CREATE POLICY "Admin and operations can manage vehicles"
  ON public.vehicles FOR ALL
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role]));

CREATE POLICY "Finance can view vehicles"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'finance'::app_role));

GRANT SELECT ON public.vehicles TO anon;