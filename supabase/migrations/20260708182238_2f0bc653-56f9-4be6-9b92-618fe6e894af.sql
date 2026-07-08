
-- 1) Audit trigger: honor a session flag to skip during bulk demo ops.
CREATE OR REPLACE FUNCTION public.audit_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_action text;
  v_diff jsonb;
  v_record_id uuid;
  v_skip text;
BEGIN
  BEGIN
    v_skip := current_setting('app.skip_audit', true);
  EXCEPTION WHEN OTHERS THEN
    v_skip := NULL;
  END;
  IF v_skip = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_diff := to_jsonb(NEW);
    v_record_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(OLD) ? 'deleted_at') THEN
      IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        v_action := 'soft_delete';
      ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        v_action := 'restore';
      ELSE
        v_action := 'update';
      END IF;
    ELSE
      v_action := 'update';
    END IF;
    v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    v_record_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_diff := to_jsonb(OLD);
    v_record_id := OLD.id;
  END IF;

  INSERT INTO public.audit_logs(table_name, record_id, action, actor_id, actor_email, diff)
  VALUES (TG_TABLE_NAME, v_record_id, v_action, auth.uid(), v_email, v_diff);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $function$;

-- 2) Booking->Financial trigger: honor same flag.
CREATE OR REPLACE FUNCTION public.create_financial_from_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cat uuid;
  v_skip text;
BEGIN
  BEGIN
    v_skip := current_setting('app.skip_audit', true);
  EXCEPTION WHEN OTHERS THEN
    v_skip := NULL;
  END;
  IF v_skip = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('confirmed','active','in_progress','completed')
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status,'') <> NEW.status)
     AND NEW.total_price IS NOT NULL AND NEW.total_price > 0
     AND NEW.deleted_at IS NULL THEN

    SELECT id INTO v_cat FROM public.financial_categories
      WHERE type = 'income' AND LOWER(name) IN ('reservas','aluguel','bookings','rental','locação')
      LIMIT 1;

    IF NOT EXISTS (
      SELECT 1 FROM public.financial_transactions
      WHERE booking_id = NEW.id AND source = 'booking_auto' AND is_cancelled = false
    ) THEN
      INSERT INTO public.financial_transactions(
        type, amount, description, transaction_date,
        booking_id, vehicle_id, category_id, source, notes
      )
      VALUES (
        'income', NEW.total_price,
        'Reserva ' || COALESCE(NEW.booking_number, substring(NEW.id::text,1,8)) || ' — ' || NEW.customer_name,
        NEW.pickup_date, NEW.id, NEW.vehicle_id, v_cat, 'booking_auto',
        'Lançamento automático ao confirmar reserva'
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.financial_transactions
      SET is_cancelled = true
      WHERE booking_id = NEW.id AND source = 'booking_auto';
  END IF;

  RETURN NEW;
END $function$;

-- 3) demo_stop_presentation: suspend audit/financial triggers during bulk restore.
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
  SET LOCAL statement_timeout = '25s';
  SET LOCAL app.skip_audit = 'on';

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

-- 4) demo_start_presentation: same suspension for bulk hide.
CREATE OR REPLACE FUNCTION public.demo_start_presentation(p_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := DATE '2026-07-07';
  v_total integer;
  v_chosen uuid[];
  v_hidden_v uuid[];
  v_hidden_b uuid[];
  v_snap jsonb;
  v_hidden_t uuid[];
  v_n_champ int;
  v_n_caroc int;
  v_n_meio  int;
BEGIN
  SET LOCAL statement_timeout = '25s';
  SET LOCAL app.skip_audit = 'on';

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

  IF p_count >= 3 THEN
    v_n_champ := GREATEST(1, ROUND(p_count * 0.20)::int);
    v_n_caroc := GREATEST(1, ROUND(p_count * 0.20)::int);
  ELSE
    v_n_champ := CASE WHEN p_count >= 2 THEN 1 ELSE 0 END;
    v_n_caroc := CASE WHEN p_count >= 1 THEN 1 ELSE 0 END;
  END IF;
  v_n_meio := p_count - v_n_champ - v_n_caroc;
  IF v_n_meio < 0 THEN v_n_meio := 0; END IF;

  WITH v AS (
    SELECT id, COALESCE(purchase_price,0)::numeric AS purchase,
           COALESCE(acquired_date, v_today - 365) AS acquired,
           GREATEST((v_today - COALESCE(acquired_date, v_today - 365)), 90) AS days_owned
      FROM public.vehicles
     WHERE deleted_at IS NULL
  ),
  b_agg AS (
    SELECT b.vehicle_id,
           COALESCE(SUM(b.total_price),0)::numeric AS rev,
           COALESCE(SUM(GREATEST(
             (LEAST(b.return_date, v_today) - GREATEST(b.pickup_date, v.acquired))::int, 0
           )),0)::int AS days_hist
      FROM public.bookings b
      JOIN v ON v.id = b.vehicle_id
     WHERE b.deleted_at IS NULL
     GROUP BY b.vehicle_id
  ),
  e_agg AS (
    SELECT e.vehicle_id, COALESCE(SUM(e.amount),0)::numeric AS exp
      FROM public.vehicle_expenses e
      JOIN v ON v.id = e.vehicle_id
     GROUP BY e.vehicle_id
  ),
  scored AS (
    SELECT v.id,
           COALESCE(b_agg.rev,0) AS rev,
           v.purchase,
           CASE WHEN v.purchase > 0
                THEN (COALESCE(b_agg.rev,0) - COALESCE(e_agg.exp,0)) / v.purchase * 100
                ELSE 0 END AS roi,
           (COALESCE(b_agg.days_hist,0)::numeric / GREATEST(v.days_owned,1)) * 100 AS occ
      FROM v
      LEFT JOIN b_agg ON b_agg.vehicle_id = v.id
      LEFT JOIN e_agg ON e_agg.vehicle_id = v.id
  ),
  ranked AS (
    SELECT s.*,
           (roi + occ*0.6) AS score,
           ROW_NUMBER() OVER (ORDER BY (roi + occ*0.6) DESC, id) AS rk_top,
           ROW_NUMBER() OVER (ORDER BY (roi + occ*0.6) ASC,  id) AS rk_bot
      FROM scored s
  ),
  champ_pick AS (
    SELECT id FROM ranked WHERE rk_top <= v_n_champ
  ),
  caroc_pick AS (
    SELECT id FROM ranked
     WHERE rk_bot <= v_n_caroc
       AND id NOT IN (SELECT id FROM champ_pick)
     LIMIT v_n_caroc
  ),
  avg_s AS (SELECT AVG(score) AS s FROM ranked),
  meio AS (
    SELECT r.id FROM ranked r, avg_s
     WHERE r.id NOT IN (SELECT id FROM champ_pick)
       AND r.id NOT IN (SELECT id FROM caroc_pick)
     ORDER BY ABS(r.score - avg_s.s), r.id
     LIMIT v_n_meio
  ),
  final_pick AS (
    SELECT id FROM champ_pick
    UNION SELECT id FROM caroc_pick
    UNION SELECT id FROM meio
  )
  SELECT array_agg(id) INTO v_chosen FROM final_pick;

  IF v_chosen IS NULL OR array_length(v_chosen,1) < p_count THEN
    WITH extra AS (
      SELECT id FROM public.vehicles
       WHERE deleted_at IS NULL AND NOT (id = ANY(COALESCE(v_chosen,'{}')))
       ORDER BY id
       LIMIT (p_count - COALESCE(array_length(v_chosen,1),0))
    )
    SELECT array_cat(COALESCE(v_chosen,'{}'), array_agg(id)) INTO v_chosen FROM extra;
  END IF;

  WITH updated AS (
    UPDATE public.vehicles SET deleted_at = now()
    WHERE deleted_at IS NULL AND NOT (id = ANY(v_chosen))
    RETURNING id
  )
  SELECT array_agg(id) INTO v_hidden_v FROM updated;

  WITH updated_b AS (
    UPDATE public.bookings SET deleted_at = now()
    WHERE deleted_at IS NULL AND vehicle_id = ANY(v_hidden_v)
    RETURNING id
  )
  SELECT array_agg(id) INTO v_hidden_b FROM updated_b;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_snap
    FROM public.vehicle_telemetry t WHERE t.vehicle_id = ANY(v_hidden_v);
  DELETE FROM public.vehicle_telemetry WHERE vehicle_id = ANY(v_hidden_v);

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
    'kept', p_count,
    'mix', jsonb_build_object('champ', v_n_champ, 'meio', v_n_meio, 'caroco', v_n_caroc)
  );
END;
$function$;
