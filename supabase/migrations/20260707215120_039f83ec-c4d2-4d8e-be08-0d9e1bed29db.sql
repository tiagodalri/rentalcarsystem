
-- =========================================================
-- DEMO SEED v3 — Recalibração de despesas por veículo
-- Idempotente: remove qualquer seed [demo-seed-v*] antes.
-- Alvo: margem consolidada 25–40%, com campeões saudáveis
-- e caroços em ~0% ou negativos.
-- =========================================================

BEGIN;

-- 1) Limpa seeds antigos (v1/v2/v3)
DELETE FROM public.vehicle_expenses
 WHERE notes LIKE '[demo-seed-v%]%';

-- 2) Semeia via DO block
DO $seed$
DECLARE
  v_today       date := DATE '2026-07-07';
  v_months      int  := 6;   -- distribui em 6 meses recentes
  r             record;
  tier          text;
  target_ratio  numeric;
  exp_target    numeric;
  monthly       numeric;
  w_dep         numeric;
  w_fin         numeric;
  w_ins         numeric;
  w_mnt         numeric;
  w_cle         numeric;
  w_tol         numeric;
  w_sum         numeric;
  m             int;
  d             date;
  seeded_sum    numeric;
  delta         numeric;
  has_financing boolean;
BEGIN
  FOR r IN (
    WITH pv AS (
      SELECT v.id,
             COALESCE(v.purchase_price,0)::numeric                                 AS purchase,
             GREATEST((v_today - COALESCE(v.acquired_date, v_today - 365)), 90)    AS days_owned,
             COALESCE((SELECT SUM(total_price) FROM public.bookings b
                        WHERE b.vehicle_id = v.id AND b.deleted_at IS NULL),0)::numeric AS rev,
             COALESCE((SELECT SUM(GREATEST(
                                    (LEAST(b.return_date, v_today)
                                     - GREATEST(b.pickup_date, COALESCE(v.acquired_date, DATE '2020-01-01'))
                                    )::int, 0))
                        FROM public.bookings b
                        WHERE b.vehicle_id = v.id AND b.deleted_at IS NULL),0) AS days_hist
      FROM public.vehicles v WHERE v.deleted_at IS NULL
    ),
    scored AS (
      SELECT *,
             (days_hist::numeric / GREATEST(days_owned,1)) * 100 AS occ,
             NTILE(4) OVER (ORDER BY (days_hist::numeric / GREATEST(days_owned,1)) DESC) AS q
      FROM pv
    )
    SELECT * FROM scored
  ) LOOP
    -- Classifica tier pela ocupação
    IF r.q = 1 THEN
      tier := 'champion';  target_ratio := 0.60;
      w_dep := 0.34; w_ins := 0.14; w_mnt := 0.06; w_cle := 0.05; w_tol := 0.05; w_fin := 0.12;
    ELSIF r.q = 4 THEN
      tier := 'carroco';   target_ratio := 1.00;
      w_dep := 0.30; w_ins := 0.13; w_mnt := 0.22; w_cle := 0.04; w_tol := 0.04; w_fin := 0.10;
    ELSE
      tier := 'meio';      target_ratio := 0.72;
      w_dep := 0.32; w_ins := 0.14; w_mnt := 0.13; w_cle := 0.05; w_tol := 0.05; w_fin := 0.12;
    END IF;

    -- ~40% da frota carrega financiamento; determinístico por hash
    has_financing := (abs(hashtext(r.id::text)) % 10) < 4;
    IF NOT has_financing THEN
      w_fin := 0;
    END IF;

    w_sum := w_dep + w_ins + w_mnt + w_cle + w_tol + w_fin;
    IF w_sum <= 0 THEN w_sum := 1; END IF;

    exp_target := r.rev * target_ratio;
    -- garante piso mínimo (carro sem receita ainda tem custo)
    IF exp_target < r.purchase * 0.05 THEN
      exp_target := r.purchase * 0.05;
    END IF;

    monthly := exp_target / v_months;

    -- 3) Insere 6 meses × 6 categorias
    FOR m IN 0..(v_months-1) LOOP
      -- último dia de cada mês (contando pra trás)
      d := (date_trunc('month', v_today) - (m || ' months')::interval + INTERVAL '1 month - 1 day')::date;
      IF d > v_today THEN d := v_today; END IF;

      INSERT INTO public.vehicle_expenses (vehicle_id, type, amount, expense_date, description, notes, status)
      VALUES
        (r.id, 'other',        ROUND(monthly * w_dep / w_sum, 2), d, 'Depreciação mensal',       '[demo-seed-v3] depreciation',  'paid'),
        (r.id, 'insurance',    ROUND(monthly * w_ins / w_sum, 2), d, 'Seguro mensal',            '[demo-seed-v3] insurance',     'paid'),
        (r.id, 'maintenance',  ROUND(monthly * w_mnt / w_sum, 2), d, 'Manutenção periódica',     '[demo-seed-v3] maintenance',   'paid'),
        (r.id, 'cleaning',     ROUND(monthly * w_cle / w_sum, 2), d, 'Higienização e detalhe',   '[demo-seed-v3] cleaning',      'paid'),
        (r.id, 'other',        ROUND(monthly * w_tol / w_sum, 2), d, 'Pedágios e SunPass',       '[demo-seed-v3] tolls',         'paid');
      IF has_financing THEN
        INSERT INTO public.vehicle_expenses (vehicle_id, type, amount, expense_date, description, notes, status)
        VALUES (r.id, 'other', ROUND(monthly * w_fin / w_sum, 2), d, 'Parcela de financiamento', '[demo-seed-v3] financing', 'paid');
      END IF;
    END LOOP;

    -- 4) Eventos extras de colisão/peças para caroços
    IF tier = 'carroco' THEN
      INSERT INTO public.vehicle_expenses (vehicle_id, type, amount, expense_date, description, notes, status)
      VALUES
        (r.id, 'parts', ROUND(r.rev * 0.06, 2), v_today - 45, 'Reparo pós-colisão (franquia)', '[demo-seed-v3] collision',  'paid'),
        (r.id, 'parts', ROUND(r.rev * 0.04, 2), v_today - 120, 'Substituição de pneus/freios', '[demo-seed-v3] parts-extra', 'paid');
    END IF;

    -- 5) Ajuste residual para bater exp_target exato
    SELECT COALESCE(SUM(amount),0) INTO seeded_sum
      FROM public.vehicle_expenses
     WHERE vehicle_id = r.id AND notes LIKE '[demo-seed-v3]%';
    delta := ROUND(exp_target - seeded_sum, 2);
    IF ABS(delta) > 0.5 THEN
      INSERT INTO public.vehicle_expenses (vehicle_id, type, amount, expense_date, description, notes, status)
      VALUES (r.id, 'other', delta, v_today, 'Ajuste consolidado', '[demo-seed-v3] ajuste', 'paid');
    END IF;
  END LOOP;
END
$seed$;

COMMIT;
