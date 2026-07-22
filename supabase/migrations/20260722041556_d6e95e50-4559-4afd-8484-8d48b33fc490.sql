
-- 1) Tabela commission_rules
CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locadora_id uuid NOT NULL REFERENCES public.locadoras(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('locadora_default','vehicle_category','vehicle','partner_override')),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  vehicle_category text,
  -- partner_id: sem FK por enquanto; tabela partners entra na Fase 3, onde a FK será adicionada
  partner_id uuid,
  commission_type text NOT NULL CHECK (commission_type IN ('percent','fixed')),
  commission_value numeric NOT NULL CHECK (commission_value >= 0),
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- coerência: o campo do escopo tem que estar preenchido, os outros nulos
  CONSTRAINT commission_rules_scope_fields_chk CHECK (
    (scope = 'locadora_default' AND vehicle_id IS NULL AND vehicle_category IS NULL AND partner_id IS NULL) OR
    (scope = 'vehicle_category' AND vehicle_id IS NULL AND vehicle_category IS NOT NULL AND partner_id IS NULL) OR
    (scope = 'vehicle' AND vehicle_id IS NOT NULL AND vehicle_category IS NULL AND partner_id IS NULL) OR
    (scope = 'partner_override' AND vehicle_id IS NULL AND vehicle_category IS NULL AND partner_id IS NOT NULL)
  )
);

CREATE INDEX commission_rules_locadora_idx ON public.commission_rules(locadora_id);
CREATE INDEX commission_rules_lookup_idx ON public.commission_rules(locadora_id, scope, is_active);
CREATE INDEX commission_rules_vehicle_idx ON public.commission_rules(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX commission_rules_partner_idx ON public.commission_rules(partner_id) WHERE partner_id IS NOT NULL;

-- 2) GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;

-- 3) RLS
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

-- Gerenciar (ALL): admin/operations da própria locadora, ou platform_admin
CREATE POLICY "Manage commission rules"
ON public.commission_rules
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[])
  AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[])
  AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
);

-- Finance pode ler
CREATE POLICY "Finance can read commission rules"
ON public.commission_rules
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'finance'::app_role)
  AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
);

-- Auto-preencher locadora_id (mesmo padrão de outras tabelas)
CREATE TRIGGER commission_rules_set_locadora
BEFORE INSERT ON public.commission_rules
FOR EACH ROW
EXECUTE FUNCTION public.set_locadora_id_from_user();

-- 4) Função resolve_commission
CREATE OR REPLACE FUNCTION public.resolve_commission(
  p_locadora_id uuid,
  p_vehicle_id uuid,
  p_partner_id uuid DEFAULT NULL,
  p_at timestamptz DEFAULT now()
)
RETURNS TABLE(commission_type text, commission_value numeric, rule_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_category text;
BEGIN
  SELECT category INTO v_category FROM public.vehicles WHERE id = p_vehicle_id;

  RETURN QUERY
  WITH candidates AS (
    SELECT r.*,
      CASE r.scope
        WHEN 'partner_override' THEN 1
        WHEN 'vehicle' THEN 2
        WHEN 'vehicle_category' THEN 3
        WHEN 'locadora_default' THEN 4
      END AS priority
    FROM public.commission_rules r
    WHERE r.locadora_id = p_locadora_id
      AND r.is_active = true
      AND (r.valid_from IS NULL OR r.valid_from <= p_at)
      AND (r.valid_until IS NULL OR r.valid_until >= p_at)
      AND (
        (r.scope = 'partner_override' AND p_partner_id IS NOT NULL AND r.partner_id = p_partner_id) OR
        (r.scope = 'vehicle' AND r.vehicle_id = p_vehicle_id) OR
        (r.scope = 'vehicle_category' AND v_category IS NOT NULL AND r.vehicle_category = v_category) OR
        (r.scope = 'locadora_default')
      )
  )
  SELECT c.commission_type, c.commission_value, c.id
  FROM candidates c
  ORDER BY c.priority ASC, c.created_at DESC
  LIMIT 1;
END;
$$;

-- 5) Campos travados de comissão em bookings
ALTER TABLE public.bookings
  ADD COLUMN commission_type text,
  ADD COLUMN commission_value numeric,
  ADD COLUMN commission_amount numeric,
  ADD COLUMN commission_rule_id uuid REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  ADD COLUMN commission_locked_at timestamptz;

COMMENT ON COLUMN public.bookings.commission_amount IS 'Comissão travada no momento da criação da reserva. Nunca recalcular automaticamente.';
