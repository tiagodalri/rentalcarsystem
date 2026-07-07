
BEGIN;
DELETE FROM public.vehicle_expenses WHERE notes LIKE '[demo-seed-v%]%';

DO $seed$
DECLARE
  v_today date := DATE '2026-07-07';
  v_months int := 6;
  r record; tier text; target_ratio numeric; exp_target numeric; monthly numeric;
  w_dep numeric; w_fin numeric; w_ins numeric; w_mnt numeric; w_cle numeric; w_tol numeric; w_sum numeric;
  m int; d date; seeded_sum numeric; delta numeric; has_financing boolean;
  jitter numeric;
BEGIN
  FOR r IN (
    WITH pv AS (
      SELECT v.id,
             COALESCE(v.purchase_price,0)::numeric AS purchase,
             GREATEST((v_today - COALESCE(v.acquired_date, v_today - 365)), 90) AS days_owned,
             COALESCE((SELECT SUM(total_price) FROM public.bookings b WHERE b.vehicle_id = v.id AND b.deleted_at IS NULL),0)::numeric AS rev,
             COALESCE((SELECT SUM(GREATEST((LEAST(b.return_date, v_today) - GREATEST(b.pickup_date, COALESCE(v.acquired_date, DATE '2020-01-01')))::int, 0))
                        FROM public.bookings b WHERE b.vehicle_id = v.id AND b.deleted_at IS NULL),0) AS days_hist
      FROM public.vehicles v
    ),
    with_rev AS (
      SELECT *, (days_hist::numeric / GREATEST(days_owned,1)) * 100 AS occ,
             NTILE(4) OVER (ORDER BY (days_hist::numeric / GREATEST(days_owned,1)) DESC) AS q_rev
      FROM pv WHERE rev > 0
    ),
    no_rev AS (
      SELECT id, purchase, days_owned, rev, days_hist, 0::numeric AS occ, 5 AS q_rev FROM pv WHERE rev = 0
    ),
    scored AS (SELECT * FROM with_rev UNION ALL SELECT * FROM no_rev)
    SELECT * FROM scored
  ) LOOP
    -- jitter determinístico por veiculo (+/- 8%)
    jitter := 1 + ((abs(hashtext(r.id::text)) % 17) - 8)::numeric / 100.0;

    IF r.q_rev = 1 THEN
      tier := 'champion'; target_ratio := 0.55 * jitter;
      w_dep := 0.34; w_ins := 0.14; w_mnt := 0.06; w_cle := 0.05; w_tol := 0.05; w_fin := 0.12;
    ELSIF r.q_rev = 4 THEN
      tier := 'carroco'; target_ratio := 1.15 * jitter;   -- margem negativa
      w_dep := 0.30; w_ins := 0.13; w_mnt := 0.22; w_cle := 0.04; w_tol := 0.04; w_fin := 0.10;
    ELSIF r.q_rev = 5 THEN
      tier := 'idle';    target_ratio := 0;   -- sem receita; só piso de posse
      w_dep := 0.60; w_ins := 0.25; w_mnt := 0.05; w_cle := 0.02; w_tol := 0.02; w_fin := 0.10;
    ELSE
      tier := 'meio'; target_ratio := 0.68 * jitter;
      w_dep := 0.32; w_ins := 0.14; w_mnt := 0.13; w_cle := 0.05; w_tol := 0.05; w_fin := 0.12;
    END IF;

    has_financing := (abs(hashtext(r.id::text)) % 10) < 4;
    IF NOT has_financing THEN w_fin := 0; END IF;
    w_sum := w_dep + w_ins + w_mnt + w_cle + w_tol + w_fin;
    IF w_sum <= 0 THEN w_sum := 1; END IF;

    IF tier = 'idle' THEN
      -- carro parado: só o custo de posse anual (~4% do valor)
      exp_target := r.purchase * 0.04 * (r.days_owned::numeric / 365.0);
      IF exp_target < 500 THEN exp_target := 500; END IF;
    ELSE
      exp_target := r.rev * target_ratio;
      IF exp_target < r.purchase * 0.03 THEN
        exp_target := r.purchase * 0.03;
      END IF;
    END IF;

    monthly := exp_target / v_months;

    FOR m IN 0..(v_months-1) LOOP
      d := (date_trunc('month', v_today) - (m || ' months')::interval + INTERVAL '1 month - 1 day')::date;
      IF d > v_today THEN d := v_today; END IF;
      INSERT INTO public.vehicle_expenses (vehicle_id, type, amount, expense_date, description, notes, status) VALUES
        (r.id, 'other',       ROUND(monthly*w_dep/w_sum,2), d, 'Depreciação mensal',     '[demo-seed-v4] depreciation','paid'),
        (r.id, 'insurance',   ROUND(monthly*w_ins/w_sum,2), d, 'Seguro mensal',          '[demo-seed-v4] insurance','paid'),
        (r.id, 'maintenance', ROUND(monthly*w_mnt/w_sum,2), d, 'Manutenção periódica',   '[demo-seed-v4] maintenance','paid'),
        (r.id, 'cleaning',    ROUND(monthly*w_cle/w_sum,2), d, 'Higienização e detalhe', '[demo-seed-v4] cleaning','paid'),
        (r.id, 'other',       ROUND(monthly*w_tol/w_sum,2), d, 'Pedágios e SunPass',     '[demo-seed-v4] tolls','paid');
      IF has_financing THEN
        INSERT INTO public.vehicle_expenses (vehicle_id, type, amount, expense_date, description, notes, status)
        VALUES (r.id, 'other', ROUND(monthly*w_fin/w_sum,2), d, 'Parcela de financiamento','[demo-seed-v4] financing','paid');
      END IF;
    END LOOP;

    IF tier = 'carroco' THEN
      INSERT INTO public.vehicle_expenses (vehicle_id, type, amount, expense_date, description, notes, status) VALUES
        (r.id, 'parts', ROUND(GREATEST(r.rev,r.purchase*0.1)*0.05,2), v_today - 45, 'Reparo pós-colisão','[demo-seed-v4] collision','paid'),
        (r.id, 'parts', ROUND(GREATEST(r.rev,r.purchase*0.1)*0.03,2), v_today - 120,'Substituição de pneus/freios','[demo-seed-v4] parts-extra','paid');
    END IF;

    SELECT COALESCE(SUM(amount),0) INTO seeded_sum FROM public.vehicle_expenses
     WHERE vehicle_id = r.id AND notes LIKE '[demo-seed-v4]%';
    delta := ROUND(exp_target - seeded_sum, 2);
    IF ABS(delta) > 0.5 THEN
      INSERT INTO public.vehicle_expenses (vehicle_id, type, amount, expense_date, description, notes, status)
      VALUES (r.id, 'other', delta, v_today, 'Ajuste consolidado', '[demo-seed-v4] ajuste','paid');
    END IF;
  END LOOP;
END $seed$;
COMMIT;
