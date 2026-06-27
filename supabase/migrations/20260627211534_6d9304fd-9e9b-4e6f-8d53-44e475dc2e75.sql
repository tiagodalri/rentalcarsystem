
-- 1) activity_logs: remove anon insert (route via edge function with service role if needed)
DROP POLICY IF EXISTS "Anon insert activity logs" ON public.activity_logs;
REVOKE INSERT ON public.activity_logs FROM anon;

-- 2) contract_templates: restrict SELECT to staff roles
DROP POLICY IF EXISTS "Authenticated can read contract template" ON public.contract_templates;
CREATE POLICY "Staff can read contract template"
  ON public.contract_templates
  FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role])
  );

-- 3) vehicles: explicit column-level grants for anon (safe columns only),
-- and scope the public-read policy to anon + authenticated explicitly.
REVOKE ALL ON public.vehicles FROM anon;
GRANT SELECT (
  id, name, category, daily_price_usd, passengers, bags, transmission, fuel,
  year, status, features, image_url, published, photos, brand, model,
  model_year, color, doors, default_deposit_amount, default_franchise_amount,
  deleted_at
) ON public.vehicles TO anon;

-- Recreate the public-view policy targeting anon explicitly (authenticated already has
-- broader staff/finance policies). Keeps existing app behaviour while making intent clear.
DROP POLICY IF EXISTS "Anyone can view vehicles" ON public.vehicles;
CREATE POLICY "Public can view published vehicles (safe columns only)"
  ON public.vehicles
  FOR SELECT
  TO anon, authenticated
  USING (published = true AND deleted_at IS NULL);
