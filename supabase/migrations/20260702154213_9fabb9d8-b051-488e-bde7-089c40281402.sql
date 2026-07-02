
-- Ampliar o estado para armazenar snapshots de tabelas sem deleted_at
ALTER TABLE public.demo_presentation_state
  ADD COLUMN IF NOT EXISTS telemetry_snapshot jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hidden_txn_ids uuid[] DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.demo_start_presentation(p_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer;
  v_chosen uuid[];
  v_hidden_v uuid[];
  v_hidden_b uuid[];
  v_snap jsonb;
  v_hidden_t uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can start the presentation';
  END IF;
  IF p_count IS NULL OR p_count < 1 THEN
    RAISE EXCEPTION 'p_count must be >= 1';
  END IF;

  PERFORM public.demo_stop_presentation();

  SELECT count(*) INTO v_total FROM public.vehicles WHERE deleted_at IS NULL;
  IF p_count >= v_total THEN
    INSERT INTO public.demo_presentation_state(id, target_count, hidden_vehicle_ids, hidden_booking_ids, started_by)
    VALUES (1, p_count, '{}', '{}', auth.uid())
    ON CONFLICT (id) DO UPDATE SET
      target_count = EXCLUDED.target_count,
      hidden_vehicle_ids = '{}',
      hidden_booking_ids = '{}',
      telemetry_snapshot = '[]'::jsonb,
      hidden_txn_ids = '{}',
      started_at = now(),
      started_by = auth.uid();
    RETURN jsonb_build_object('hidden_vehicles', 0, 'hidden_bookings', 0, 'kept', v_total);
  END IF;

  WITH pool AS (
    SELECT id, category, COALESCE(daily_price_usd, 0) AS price,
      ROW_NUMBER() OVER (PARTITION BY category ORDER BY random()) AS rn
    FROM public.vehicles WHERE deleted_at IS NULL
  ),
  seeded AS (SELECT id FROM pool WHERE rn = 1 ORDER BY random() LIMIT p_count),
  remaining AS (
    SELECT id FROM pool WHERE id NOT IN (SELECT id FROM seeded)
    ORDER BY random() * (0.55 + LEAST(price, 200) / 200.0) DESC
    LIMIT GREATEST(0, p_count - (SELECT count(*) FROM seeded))
  )
  SELECT array_agg(id) INTO v_chosen FROM (
    SELECT id FROM seeded UNION SELECT id FROM remaining
  ) x;

  -- Soft-delete veículos não escolhidos
  WITH updated AS (
    UPDATE public.vehicles SET deleted_at = now()
    WHERE deleted_at IS NULL AND NOT (id = ANY(v_chosen))
    RETURNING id
  )
  SELECT array_agg(id) INTO v_hidden_v FROM updated;

  -- Soft-delete reservas dos veículos ocultos
  WITH updated_b AS (
    UPDATE public.bookings SET deleted_at = now()
    WHERE deleted_at IS NULL AND vehicle_id = ANY(v_hidden_v)
    RETURNING id
  )
  SELECT array_agg(id) INTO v_hidden_b FROM updated_b;

  -- Snapshot + delete telemetria dos veículos ocultos (rastreador)
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_snap
    FROM public.vehicle_telemetry t
    WHERE t.vehicle_id = ANY(v_hidden_v);
  DELETE FROM public.vehicle_telemetry WHERE vehicle_id = ANY(v_hidden_v);

  -- Soft-delete lançamentos financeiros ligados aos veículos/reservas ocultos
  WITH upd_t AS (
    UPDATE public.financial_transactions SET deleted_at = now()
    WHERE deleted_at IS NULL
      AND (vehicle_id = ANY(v_hidden_v) OR booking_id = ANY(COALESCE(v_hidden_b,'{}')))
    RETURNING id
  )
  SELECT array_agg(id) INTO v_hidden_t FROM upd_t;

  INSERT INTO public.demo_presentation_state(id, target_count, hidden_vehicle_ids, hidden_booking_ids, telemetry_snapshot, hidden_txn_ids, started_by)
  VALUES (1, p_count, COALESCE(v_hidden_v,'{}'), COALESCE(v_hidden_b,'{}'), v_snap, COALESCE(v_hidden_t,'{}'), auth.uid())
  ON CONFLICT (id) DO UPDATE SET
    target_count = EXCLUDED.target_count,
    hidden_vehicle_ids = EXCLUDED.hidden_vehicle_ids,
    hidden_booking_ids = EXCLUDED.hidden_booking_ids,
    telemetry_snapshot = EXCLUDED.telemetry_snapshot,
    hidden_txn_ids = EXCLUDED.hidden_txn_ids,
    started_at = now(),
    started_by = auth.uid();

  RETURN jsonb_build_object(
    'hidden_vehicles', COALESCE(array_length(v_hidden_v,1),0),
    'hidden_bookings', COALESCE(array_length(v_hidden_b,1),0),
    'hidden_telemetry', COALESCE(jsonb_array_length(v_snap),0),
    'hidden_transactions', COALESCE(array_length(v_hidden_t,1),0),
    'kept', p_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.demo_stop_presentation()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state public.demo_presentation_state%ROWTYPE;
  v_v integer := 0;
  v_b integer := 0;
  v_t integer := 0;
  v_ft integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can stop the presentation';
  END IF;

  SELECT * INTO v_state FROM public.demo_presentation_state WHERE id = 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('restored_vehicles', 0, 'restored_bookings', 0);
  END IF;

  IF v_state.hidden_vehicle_ids IS NOT NULL AND array_length(v_state.hidden_vehicle_ids,1) > 0 THEN
    UPDATE public.vehicles SET deleted_at = NULL WHERE id = ANY(v_state.hidden_vehicle_ids);
    GET DIAGNOSTICS v_v = ROW_COUNT;
  END IF;

  IF v_state.hidden_booking_ids IS NOT NULL AND array_length(v_state.hidden_booking_ids,1) > 0 THEN
    UPDATE public.bookings SET deleted_at = NULL WHERE id = ANY(v_state.hidden_booking_ids);
    GET DIAGNOSTICS v_b = ROW_COUNT;
  END IF;

  IF v_state.hidden_txn_ids IS NOT NULL AND array_length(v_state.hidden_txn_ids,1) > 0 THEN
    UPDATE public.financial_transactions SET deleted_at = NULL WHERE id = ANY(v_state.hidden_txn_ids);
    GET DIAGNOSTICS v_ft = ROW_COUNT;
  END IF;

  -- Restaura telemetria
  IF v_state.telemetry_snapshot IS NOT NULL AND jsonb_array_length(v_state.telemetry_snapshot) > 0 THEN
    INSERT INTO public.vehicle_telemetry
    SELECT * FROM jsonb_populate_recordset(NULL::public.vehicle_telemetry, v_state.telemetry_snapshot)
    ON CONFLICT (vehicle_id) DO NOTHING;
    GET DIAGNOSTICS v_t = ROW_COUNT;
  END IF;

  DELETE FROM public.demo_presentation_state WHERE id = 1;

  RETURN jsonb_build_object(
    'restored_vehicles', v_v,
    'restored_bookings', v_b,
    'restored_telemetry', v_t,
    'restored_transactions', v_ft
  );
END;
$function$;
