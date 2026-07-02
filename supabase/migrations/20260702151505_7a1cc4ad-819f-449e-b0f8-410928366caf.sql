
CREATE TABLE IF NOT EXISTS public.demo_presentation_state (
  id smallint PRIMARY KEY DEFAULT 1,
  target_count integer NOT NULL,
  hidden_vehicle_ids uuid[] NOT NULL DEFAULT '{}',
  hidden_booking_ids uuid[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  started_by uuid,
  CONSTRAINT demo_presentation_state_singleton CHECK (id = 1)
);

GRANT SELECT ON public.demo_presentation_state TO authenticated;
GRANT ALL ON public.demo_presentation_state TO service_role;

ALTER TABLE public.demo_presentation_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view presentation state" ON public.demo_presentation_state;
CREATE POLICY "Admins can view presentation state"
  ON public.demo_presentation_state FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.demo_start_presentation(p_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_chosen uuid[];
  v_hidden_v uuid[];
  v_hidden_b uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can start the presentation';
  END IF;
  IF p_count IS NULL OR p_count < 1 THEN
    RAISE EXCEPTION 'p_count must be >= 1';
  END IF;

  -- If a presentation is active, restore first to have a clean baseline
  PERFORM public.demo_stop_presentation();

  SELECT count(*) INTO v_total FROM public.vehicles WHERE deleted_at IS NULL;
  IF p_count >= v_total THEN
    INSERT INTO public.demo_presentation_state(id, target_count, hidden_vehicle_ids, hidden_booking_ids, started_by)
    VALUES (1, p_count, '{}', '{}', auth.uid())
    ON CONFLICT (id) DO UPDATE SET
      target_count = EXCLUDED.target_count,
      hidden_vehicle_ids = '{}',
      hidden_booking_ids = '{}',
      started_at = now(),
      started_by = auth.uid();
    RETURN jsonb_build_object('hidden_vehicles', 0, 'hidden_bookings', 0, 'kept', v_total);
  END IF;

  -- Smart mix: one per category (random within category) up to p_count,
  -- then fill remaining preferring higher daily price (popular + a touch of premium)
  WITH pool AS (
    SELECT id, category, COALESCE(daily_price_usd, 0) AS price,
      ROW_NUMBER() OVER (PARTITION BY category ORDER BY random()) AS rn
    FROM public.vehicles
    WHERE deleted_at IS NULL
  ),
  seeded AS (
    SELECT id FROM pool WHERE rn = 1 ORDER BY random() LIMIT p_count
  ),
  remaining AS (
    SELECT id FROM pool
    WHERE id NOT IN (SELECT id FROM seeded)
    ORDER BY random() * (0.55 + LEAST(price, 200) / 200.0) DESC
    LIMIT GREATEST(0, p_count - (SELECT count(*) FROM seeded))
  )
  SELECT array_agg(id) INTO v_chosen FROM (
    SELECT id FROM seeded UNION SELECT id FROM remaining
  ) x;

  -- Soft-delete vehicles not chosen
  WITH updated AS (
    UPDATE public.vehicles
    SET deleted_at = now()
    WHERE deleted_at IS NULL AND NOT (id = ANY(v_chosen))
    RETURNING id
  )
  SELECT array_agg(id) INTO v_hidden_v FROM updated;

  -- Soft-delete their bookings so lists/agendas/relatórios ficam coerentes
  WITH updated_b AS (
    UPDATE public.bookings
    SET deleted_at = now()
    WHERE deleted_at IS NULL AND vehicle_id = ANY(v_hidden_v)
    RETURNING id
  )
  SELECT array_agg(id) INTO v_hidden_b FROM updated_b;

  INSERT INTO public.demo_presentation_state(id, target_count, hidden_vehicle_ids, hidden_booking_ids, started_by)
  VALUES (1, p_count, COALESCE(v_hidden_v, '{}'), COALESCE(v_hidden_b, '{}'), auth.uid())
  ON CONFLICT (id) DO UPDATE SET
    target_count = EXCLUDED.target_count,
    hidden_vehicle_ids = EXCLUDED.hidden_vehicle_ids,
    hidden_booking_ids = EXCLUDED.hidden_booking_ids,
    started_at = now(),
    started_by = auth.uid();

  RETURN jsonb_build_object(
    'hidden_vehicles', COALESCE(array_length(v_hidden_v, 1), 0),
    'hidden_bookings', COALESCE(array_length(v_hidden_b, 1), 0),
    'kept', p_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.demo_stop_presentation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state public.demo_presentation_state%ROWTYPE;
  v_v integer := 0;
  v_b integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can stop the presentation';
  END IF;

  SELECT * INTO v_state FROM public.demo_presentation_state WHERE id = 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('restored_vehicles', 0, 'restored_bookings', 0);
  END IF;

  IF v_state.hidden_vehicle_ids IS NOT NULL AND array_length(v_state.hidden_vehicle_ids, 1) > 0 THEN
    UPDATE public.vehicles SET deleted_at = NULL
      WHERE id = ANY(v_state.hidden_vehicle_ids);
    GET DIAGNOSTICS v_v = ROW_COUNT;
  END IF;

  IF v_state.hidden_booking_ids IS NOT NULL AND array_length(v_state.hidden_booking_ids, 1) > 0 THEN
    UPDATE public.bookings SET deleted_at = NULL
      WHERE id = ANY(v_state.hidden_booking_ids);
    GET DIAGNOSTICS v_b = ROW_COUNT;
  END IF;

  DELETE FROM public.demo_presentation_state WHERE id = 1;

  RETURN jsonb_build_object('restored_vehicles', v_v, 'restored_bookings', v_b);
END;
$$;

GRANT EXECUTE ON FUNCTION public.demo_start_presentation(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.demo_stop_presentation() TO authenticated;
