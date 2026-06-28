-- Fix 1 (SUPA_security_definer_view): rebuild vehicles_public with security_invoker=true
-- so the view enforces the querying user's permissions/RLS, not the view owner's.
DROP VIEW IF EXISTS public.vehicles_public CASCADE;

CREATE VIEW public.vehicles_public
WITH (security_invoker = true) AS
SELECT
  id, name, category, daily_price_usd, image_url, passengers, bags,
  transmission, fuel, year, status, features, created_at, updated_at,
  color, engine_type, engine_size, doors, published, photos, brand,
  model, manufacture_year, model_year, deleted_at,
  default_deposit_amount, default_franchise_amount
FROM public.vehicles
WHERE published = true AND deleted_at IS NULL;

GRANT SELECT ON public.vehicles_public TO anon, authenticated;

-- Fix 2 (vehicles_anon_sensitive_columns): remove the anon row-level policy on
-- public.vehicles so anon can never read the underlying table even if a future
-- migration accidentally grants SELECT on it. Anonymous browsing now must go
-- exclusively through the marketing-safe vehicles_public view.
DROP POLICY IF EXISTS "Anon can browse published vehicles" ON public.vehicles;
REVOKE SELECT ON public.vehicles FROM anon;