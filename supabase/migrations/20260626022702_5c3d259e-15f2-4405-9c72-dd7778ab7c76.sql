
-- 1) Vehicles: restringir colunas sensíveis para visitantes anônimos
REVOKE SELECT ON public.vehicles FROM anon;
GRANT SELECT (
  id, name, category, daily_price_usd, passengers, bags, transmission,
  fuel, year, status, features, image_url, published, photos, brand,
  model, model_year, color, doors, default_deposit_amount,
  default_franchise_amount, deleted_at
) ON public.vehicles TO anon;

-- 2) Pricing: remover acesso público direto (precificação só via get_vehicle_pricing)
DROP POLICY IF EXISTS "Public can read pricing rules" ON public.vehicle_pricing_rules;
DROP POLICY IF EXISTS "Public can read price seasons" ON public.vehicle_price_seasons;
DROP POLICY IF EXISTS "Public can read price overrides" ON public.vehicle_price_overrides;

-- 3) Bouncie backfill: remover policy que liberava para qualquer usuário autenticado
DROP POLICY IF EXISTS "backfill progress readable by authenticated" ON public.bouncie_backfill_progress;

-- 4) Realtime: fechar canais não previstos (default era ELSE true)
DROP POLICY IF EXISTS "Staff can receive vehicle telemetry broadcasts" ON realtime.messages;
CREATE POLICY "Staff can receive vehicle telemetry broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'vehicle-telemetry%'
        OR realtime.topic() LIKE 'fleet-live%'
        OR realtime.topic() LIKE 'trip-events%'
      THEN has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'finance'::app_role, 'support'::app_role])
      ELSE false
    END
  );
