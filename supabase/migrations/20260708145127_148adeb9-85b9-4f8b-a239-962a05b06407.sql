
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
  -- Rede de segurança contra statement_timeout global
  SET LOCAL statement_timeout = '25s';

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

  -- Cotas por tier (mínimo 1 campeão e 1 caroço quando N>=3)
  IF p_count >= 3 THEN
    v_n_champ := GREATEST(1, ROUND(p_count * 0.20)::int);
    v_n_caroc := GREATEST(1, ROUND(p_count * 0.20)::int);
  ELSE
    v_n_champ := CASE WHEN p_count >= 2 THEN 1 ELSE 0 END;
    v_n_caroc := CASE WHEN p_count >= 1 THEN 1 ELSE 0 END;
  END IF;
  v_n_meio := p_count - v_n_champ - v_n_caroc;
  IF v_n_meio < 0 THEN v_n_meio := 0; END IF;

  -- Métricas por veículo em UMA passada:
  -- - agrega receita/dias de bookings via LEFT JOIN + GROUP BY
  -- - agrega despesas via LEFT JOIN + GROUP BY
  -- - sem subconsulta correlacionada por linha
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

  -- Fallback: completa com quaisquer restantes se por algum motivo faltou
  IF v_chosen IS NULL OR array_length(v_chosen,1) < p_count THEN
    WITH extra AS (
      SELECT id FROM public.vehicles
       WHERE deleted_at IS NULL AND NOT (id = ANY(COALESCE(v_chosen,'{}')))
       ORDER BY id
       LIMIT (p_count - COALESCE(array_length(v_chosen,1),0))
    )
    SELECT array_cat(COALESCE(v_chosen,'{}'), array_agg(id)) INTO v_chosen FROM extra;
  END IF;

  -- Soft-delete veículos não escolhidos
  WITH updated AS (
    UPDATE public.vehicles SET deleted_at = now()
    WHERE deleted_at IS NULL AND NOT (id = ANY(v_chosen))
    RETURNING id
  )
  SELECT array_agg(id) INTO v_hidden_v FROM updated;

  -- Soft-delete reservas dos ocultos
  WITH updated_b AS (
    UPDATE public.bookings SET deleted_at = now()
    WHERE deleted_at IS NULL AND vehicle_id = ANY(v_hidden_v)
    RETURNING id
  )
  SELECT array_agg(id) INTO v_hidden_b FROM updated_b;

  -- Snapshot + delete telemetria
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_snap
    FROM public.vehicle_telemetry t WHERE t.vehicle_id = ANY(v_hidden_v);
  DELETE FROM public.vehicle_telemetry WHERE vehicle_id = ANY(v_hidden_v);

  -- Soft-delete financeiro ligado
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
