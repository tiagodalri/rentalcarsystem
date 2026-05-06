
CREATE OR REPLACE FUNCTION public.get_occupancy_rate()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_start date := date_trunc('month', CURRENT_DATE)::date;
  month_end date := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
  days_in_month integer := EXTRACT(DAY FROM month_end)::integer;
  active_vehicles integer;
  rented_days numeric := 0;
BEGIN
  SELECT COUNT(*) INTO active_vehicles
  FROM public.vehicles
  WHERE status != 'sold';

  IF active_vehicles = 0 OR days_in_month = 0 THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(
    GREATEST(0, LEAST(b.return_date, month_end) - GREATEST(b.pickup_date, month_start) + 1)
  ), 0) INTO rented_days
  FROM public.bookings b
  WHERE b.status IN ('confirmed', 'in_progress', 'completed')
    AND b.pickup_date <= month_end
    AND b.return_date >= month_start;

  RETURN ROUND((rented_days / (active_vehicles * days_in_month)) * 100, 1);
END;
$$;
