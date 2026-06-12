-- Switch exclusion constraint to half-open daterange so same-day turnaround is allowed
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    daterange(pickup_date, return_date, '[)') WITH &&
  )
  WHERE (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'active'::text, 'in_progress'::text]));

-- Keep availability RPC consistent with the new model
CREATE OR REPLACE FUNCTION public.check_vehicle_availability(p_vehicle_id uuid, p_pickup date, p_return date, p_exclude_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE vehicle_id = p_vehicle_id
      AND deleted_at IS NULL
      AND status IN ('pending','confirmed','active','in_progress')
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
      AND daterange(pickup_date, return_date, '[)')
          && daterange(p_pickup, p_return, '[)')
  );
$function$;