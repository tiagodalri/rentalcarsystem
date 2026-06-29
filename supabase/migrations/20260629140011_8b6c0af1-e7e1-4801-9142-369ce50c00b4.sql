
-- ============================================================
-- 1) VEHICLES: restrict broad SELECT, add safe RPCs for drivers
-- ============================================================
DROP POLICY IF EXISTS "Internal team can view vehicles" ON public.vehicles;

CREATE POLICY "Senior staff can view all vehicle data"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  public.has_any_role(
    auth.uid(),
    ARRAY['admin','operations','finance','support']::app_role[]
  )
);

-- Safe vehicle list for any internal team member (drivers included)
CREATE OR REPLACE FUNCTION public.list_vehicles_basic()
RETURNS TABLE(
  id uuid,
  name text,
  brand text,
  model text,
  year integer,
  color text,
  category text,
  image_url text,
  photos jsonb,
  status text,
  license_plate text,
  current_odometer integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.name, v.brand, v.model, v.year, v.color, v.category,
         v.image_url, to_jsonb(v.photos) AS photos, v.status,
         v.license_plate, v.current_odometer
  FROM public.vehicles v
  WHERE v.deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.list_vehicles_basic() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_vehicles_basic() TO authenticated;

-- Single-vehicle safe lookup (used by inspection flow for drivers)
CREATE OR REPLACE FUNCTION public.get_vehicle_basic(p_vehicle_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  brand text,
  model text,
  year integer,
  color text,
  category text,
  image_url text,
  photos jsonb,
  status text,
  license_plate text,
  current_odometer integer,
  fuel text,
  transmission text,
  doors integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.name, v.brand, v.model, v.year, v.color, v.category,
         v.image_url, to_jsonb(v.photos) AS photos, v.status,
         v.license_plate, v.current_odometer, v.fuel, v.transmission, v.doors
  FROM public.vehicles v
  WHERE v.id = p_vehicle_id
    AND v.deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_vehicle_basic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vehicle_basic(uuid) TO authenticated;

-- ============================================================
-- 2) PAYMENT_REQUESTS: hide cr_token from authenticated reads
--    Only service_role (edge functions) keeps access to it.
-- ============================================================
REVOKE SELECT ON public.payment_requests FROM authenticated;
GRANT SELECT
  (id, booking_id, order_id, cr_id, cr_code, amount_usd, status,
   payment_method, checkout_url, paid_at, raw, created_at, updated_at)
  ON public.payment_requests TO authenticated;
