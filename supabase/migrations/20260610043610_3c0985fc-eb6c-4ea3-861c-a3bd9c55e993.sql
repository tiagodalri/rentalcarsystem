-- =========================================================
-- 1) vehicle_price_seasons
-- =========================================================
CREATE TABLE public.vehicle_price_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  price_usd numeric(10,2) NOT NULL CHECK (price_usd >= 0),
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_price_seasons_range_chk CHECK (end_date >= start_date)
);
CREATE INDEX idx_vps_vehicle ON public.vehicle_price_seasons(vehicle_id);
CREATE INDEX idx_vps_range ON public.vehicle_price_seasons(vehicle_id, start_date, end_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_price_seasons TO authenticated;
GRANT SELECT ON public.vehicle_price_seasons TO anon;
GRANT ALL ON public.vehicle_price_seasons TO service_role;

ALTER TABLE public.vehicle_price_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read price seasons"
  ON public.vehicle_price_seasons FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can manage price seasons"
  ON public.vehicle_price_seasons FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_vps_updated_at
  BEFORE UPDATE ON public.vehicle_price_seasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2) vehicle_price_overrides
-- =========================================================
CREATE TABLE public.vehicle_price_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  date date NOT NULL,
  price_usd numeric(10,2) NOT NULL CHECK (price_usd >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, date)
);
CREATE INDEX idx_vpo_vehicle_date ON public.vehicle_price_overrides(vehicle_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_price_overrides TO authenticated;
GRANT SELECT ON public.vehicle_price_overrides TO anon;
GRANT ALL ON public.vehicle_price_overrides TO service_role;

ALTER TABLE public.vehicle_price_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read price overrides"
  ON public.vehicle_price_overrides FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can manage price overrides"
  ON public.vehicle_price_overrides FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_vpo_updated_at
  BEFORE UPDATE ON public.vehicle_price_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 3) vehicle_pricing_rules (one row per vehicle)
-- =========================================================
CREATE TABLE public.vehicle_pricing_rules (
  vehicle_id uuid PRIMARY KEY REFERENCES public.vehicles(id) ON DELETE CASCADE,
  weekend_multiplier numeric(5,3) NOT NULL DEFAULT 1.000 CHECK (weekend_multiplier > 0),
  weekly_discount_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (weekly_discount_pct >= 0 AND weekly_discount_pct <= 100),
  monthly_discount_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (monthly_discount_pct >= 0 AND monthly_discount_pct <= 100),
  min_nights integer NOT NULL DEFAULT 1 CHECK (min_nights >= 1),
  weekend_days integer[] NOT NULL DEFAULT ARRAY[5,6], -- 0=Sun..6=Sat
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_pricing_rules TO authenticated;
GRANT SELECT ON public.vehicle_pricing_rules TO anon;
GRANT ALL ON public.vehicle_pricing_rules TO service_role;

ALTER TABLE public.vehicle_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read pricing rules"
  ON public.vehicle_pricing_rules FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can manage pricing rules"
  ON public.vehicle_pricing_rules FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_vpr_updated_at
  BEFORE UPDATE ON public.vehicle_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4) RPC: get_vehicle_pricing(vehicle_id, pickup, return)
-- Computes night-by-night subtotal applying override > season > base,
-- weekend multiplier, then duration discount.
-- Convention: nights = return_date - pickup_date (exclusive return).
-- If return == pickup, treats as 1 night.
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_vehicle_pricing(
  p_vehicle_id uuid,
  p_pickup date,
  p_return date
)
RETURNS TABLE (
  nights integer,
  subtotal_rental numeric,
  avg_per_day numeric,
  discount_pct numeric,
  base_price numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base numeric;
  v_rules record;
  v_nights integer;
  v_subtotal numeric := 0;
  v_day date;
  v_price numeric;
  v_dow integer;
  v_disc numeric := 0;
  v_end date;
BEGIN
  SELECT COALESCE(daily_price_usd, 0) INTO v_base
  FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_base IS NULL THEN v_base := 0; END IF;

  SELECT weekend_multiplier, weekly_discount_pct, monthly_discount_pct, weekend_days
    INTO v_rules
  FROM public.vehicle_pricing_rules WHERE vehicle_id = p_vehicle_id;
  IF NOT FOUND THEN
    v_rules.weekend_multiplier := 1.0;
    v_rules.weekly_discount_pct := 0;
    v_rules.monthly_discount_pct := 0;
    v_rules.weekend_days := ARRAY[5,6];
  END IF;

  -- nights: at least 1
  v_end := p_return;
  IF v_end <= p_pickup THEN
    v_nights := 1;
    v_end := p_pickup + 1;
  ELSE
    v_nights := (v_end - p_pickup);
  END IF;

  v_day := p_pickup;
  WHILE v_day < v_end LOOP
    -- 1) override
    SELECT price_usd INTO v_price
    FROM public.vehicle_price_overrides
    WHERE vehicle_id = p_vehicle_id AND date = v_day;

    -- 2) season (highest priority covering the date)
    IF v_price IS NULL THEN
      SELECT price_usd INTO v_price
      FROM public.vehicle_price_seasons
      WHERE vehicle_id = p_vehicle_id
        AND v_day BETWEEN start_date AND end_date
      ORDER BY priority DESC, start_date ASC
      LIMIT 1;
    END IF;

    -- 3) base
    IF v_price IS NULL THEN v_price := v_base; END IF;

    -- weekend multiplier
    v_dow := EXTRACT(DOW FROM v_day)::integer; -- 0=Sun..6=Sat
    IF v_dow = ANY(v_rules.weekend_days) THEN
      v_price := v_price * v_rules.weekend_multiplier;
    END IF;

    v_subtotal := v_subtotal + v_price;
    v_day := v_day + 1;
  END LOOP;

  -- duration discount
  IF v_nights >= 30 THEN
    v_disc := v_rules.monthly_discount_pct;
  ELSIF v_nights >= 7 THEN
    v_disc := v_rules.weekly_discount_pct;
  END IF;

  v_subtotal := ROUND(v_subtotal * (1 - v_disc / 100.0), 2);

  RETURN QUERY SELECT
    v_nights,
    v_subtotal,
    CASE WHEN v_nights > 0 THEN ROUND(v_subtotal / v_nights, 2) ELSE 0 END,
    v_disc,
    v_base;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vehicle_pricing(uuid, date, date) TO anon, authenticated, service_role;