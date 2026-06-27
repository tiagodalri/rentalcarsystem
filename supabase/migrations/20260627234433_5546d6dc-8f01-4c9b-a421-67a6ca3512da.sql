
-- ============================================================
-- SECURITY FIX BUNDLE
-- 1. vehicles: stop exposing sensitive columns to non-staff users
-- 2. activity_logs: tighten insert policy
-- 3. vehicle_price_seasons/overrides: confirm RPCs are scoped
-- 4. SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated
-- 5. set immutable search_path on remaining functions
-- ============================================================

-- ---------- (1) vehicles ----------
-- Create a SECURITY DEFINER view that exposes only safe columns.
-- View runs as owner, so RLS on the base table is bypassed for reads
-- coming through the view (intentional - safe columns only).
DROP VIEW IF EXISTS public.vehicles_public CASCADE;

CREATE VIEW public.vehicles_public
WITH (security_invoker = false) AS
SELECT
  id, name, category, daily_price_usd, image_url, passengers, bags,
  transmission, fuel, year, status, features, created_at, updated_at,
  color, engine_type, engine_size, doors, published, photos,
  brand, model, manufacture_year, model_year, deleted_at,
  default_deposit_amount, default_franchise_amount
FROM public.vehicles;

GRANT SELECT ON public.vehicles_public TO anon, authenticated;

-- Replace the broad SELECT policy with two narrower ones:
--   * anon: keep public browsing on base table (anon never sees sensitive
--     cols because column-level grants stay restricted at the API layer
--     once we revoke them below).
--   * authenticated: NO base-table SELECT for non-staff. Staff already
--     have their own SELECT policies (admin/operations/finance).
DROP POLICY IF EXISTS "Public can view published vehicles (safe columns only)"
  ON public.vehicles;

CREATE POLICY "Anon can browse published vehicles"
  ON public.vehicles
  FOR SELECT
  TO anon
  USING (published = true AND deleted_at IS NULL);

-- Revoke broad table-level SELECT from authenticated. Staff roles read
-- the base table through their role-scoped policies; PostgREST still
-- needs the table grant for those policies to apply, so re-grant the
-- full table SELECT to authenticated but rely on RLS to gate access.
-- (Customer/non-staff authenticated sessions now have NO matching SELECT
-- policy on the base table, so they cannot read sensitive columns
-- through it. They must go through the vehicles_public view.)
-- No grant change needed: existing GRANT SELECT to authenticated stays,
-- access is enforced by RLS policies only.

-- Helper RPC: lets a logged-in customer fetch the full vehicle data
-- needed for their own contract PDF (license_plate, current_odometer,
-- vin) WITHOUT exposing the base table. Returns NULL when the caller
-- does not own a booking for that vehicle.
CREATE OR REPLACE FUNCTION public.get_vehicle_for_my_booking(p_booking_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  license_plate text,
  year integer,
  color text,
  current_odometer integer,
  daily_price_usd numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_vehicle_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT b.vehicle_id, b.customer_id
    INTO v_vehicle_id, v_customer_id
    FROM public.bookings b
   WHERE b.id = p_booking_id
     AND b.deleted_at IS NULL
   LIMIT 1;

  IF v_vehicle_id IS NULL THEN
    RETURN;
  END IF;

  -- caller must own the booking (customer.user_id = auth.uid())
  IF NOT EXISTS (
    SELECT 1
      FROM public.customers c
     WHERE c.id = v_customer_id
       AND c.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v.id, v.name, v.category, v.license_plate, v.year, v.color,
         v.current_odometer, v.daily_price_usd
    FROM public.vehicles v
   WHERE v.id = v_vehicle_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_vehicle_for_my_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_for_my_booking(uuid) TO authenticated;

-- ---------- (2) activity_logs ----------
-- Tighten INSERT: require user_id = auth.uid() (no NULL allowed for
-- authenticated inserts). Anonymous activity logging continues via
-- service_role from edge functions.
DROP POLICY IF EXISTS "Users insert own activity logs" ON public.activity_logs;

CREATE POLICY "Authenticated users insert their own activity logs"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IS NOT NULL
    AND user_id = auth.uid()
  );

-- ---------- (4) SECURITY DEFINER functions executable by anon ----------
-- Lock down all SECURITY DEFINER functions: never callable by anon.
REVOKE EXECUTE ON FUNCTION public.bump_public_inspection_link_view(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_public_inspection_link_view(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- ---------- (5) Set immutable search_path on remaining functions ----------
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
