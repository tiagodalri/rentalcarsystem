
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING GIST (
    vehicle_id WITH =,
    daterange(pickup_date, return_date, '[]') WITH &&
  )
  WHERE (status IN ('pending','confirmed','active','in_progress'));

CREATE OR REPLACE FUNCTION public.check_vehicle_availability(
  p_vehicle_id uuid,
  p_pickup date,
  p_return date,
  p_exclude_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE vehicle_id = p_vehicle_id
      AND status IN ('pending','confirmed','active','in_progress')
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
      AND daterange(pickup_date, return_date, '[]')
          && daterange(p_pickup, p_return, '[]')
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_vehicle_availability(uuid, date, date, uuid) TO anon, authenticated;
