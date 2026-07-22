
-- =========================================================
-- 1) LOCADORAS
-- =========================================================
CREATE TABLE public.locadoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  logo_url text,
  contact_email text,
  contact_phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.locadoras TO authenticated;
GRANT ALL ON public.locadoras TO service_role;

ALTER TABLE public.locadoras ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_locadoras_updated_at
  BEFORE UPDATE ON public.locadoras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2) COLUNAS locadora_id (nullable primeiro, backfill depois)
-- =========================================================
ALTER TABLE public.vehicles  ADD COLUMN locadora_id uuid REFERENCES public.locadoras(id);
ALTER TABLE public.bookings  ADD COLUMN locadora_id uuid REFERENCES public.locadoras(id);
ALTER TABLE public.customers ADD COLUMN locadora_id uuid REFERENCES public.locadoras(id);
ALTER TABLE public.user_roles ADD COLUMN locadora_id uuid REFERENCES public.locadoras(id);

-- =========================================================
-- 3) Insere locadora padrão + backfill + NOT NULL
-- =========================================================
DO $mig$
DECLARE
  v_id uuid := 'd0da1220-0000-4000-8000-00000000d01a';
BEGIN
  INSERT INTO public.locadoras (id, name, legal_name)
  VALUES (v_id, 'GoDalz', 'GoDalz');

  UPDATE public.vehicles  SET locadora_id = v_id WHERE locadora_id IS NULL;
  UPDATE public.bookings  SET locadora_id = v_id WHERE locadora_id IS NULL;
  UPDATE public.customers SET locadora_id = v_id WHERE locadora_id IS NULL;
  UPDATE public.user_roles SET locadora_id = v_id
    WHERE role = 'admin' AND locadora_id IS NULL;

  EXECUTE 'ALTER TABLE public.vehicles  ALTER COLUMN locadora_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.bookings  ALTER COLUMN locadora_id SET NOT NULL';
  EXECUTE 'ALTER TABLE public.customers ALTER COLUMN locadora_id SET NOT NULL';
END $mig$;

CREATE INDEX idx_vehicles_locadora  ON public.vehicles(locadora_id);
CREATE INDEX idx_bookings_locadora  ON public.bookings(locadora_id);
CREATE INDEX idx_customers_locadora ON public.customers(locadora_id);
CREATE INDEX idx_user_roles_locadora ON public.user_roles(locadora_id);

-- =========================================================
-- 4) platform_admin para os 2 admins atuais
-- =========================================================
INSERT INTO public.user_roles (user_id, role, locadora_id) VALUES
  ('feded5c5-131a-4f85-9393-b0f528a2fe60', 'platform_admin', NULL),
  ('f02c3689-eff7-4059-a44e-56506e7f4046', 'platform_admin', NULL)
ON CONFLICT (user_id, role) DO NOTHING;

-- =========================================================
-- 5) Funções auxiliares
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_user_locadora_id(uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT locadora_id
    FROM public.user_roles
   WHERE user_id = uid
     AND locadora_id IS NOT NULL
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = uid AND role = 'platform_admin'
  )
$$;

-- =========================================================
-- 6) Policies de locadoras
-- =========================================================
CREATE POLICY "Platform admins manage locadoras"
  ON public.locadoras
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their own locadora"
  ON public.locadoras
  FOR SELECT
  TO authenticated
  USING (id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()));

-- =========================================================
-- 7) Reescrita de policies com escopo por locadora
--    (mantém policies de cliente final intactas)
-- =========================================================

-- VEHICLES
DROP POLICY IF EXISTS "Admin and operations can manage vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Senior staff can view all vehicle data" ON public.vehicles;

CREATE POLICY "Admin and operations can manage vehicles"
  ON public.vehicles
  FOR ALL
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role])
    AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role])
    AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
  );

CREATE POLICY "Senior staff can view all vehicle data"
  ON public.vehicles
  FOR SELECT
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role,'finance'::app_role,'support'::app_role])
    AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
  );

-- BOOKINGS
DROP POLICY IF EXISTS "Admin and operations can manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Driver can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Finance and support can view bookings" ON public.bookings;

CREATE POLICY "Admin and operations can manage bookings"
  ON public.bookings
  FOR ALL
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role])
    AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'operations'::app_role])
    AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
  );

CREATE POLICY "Driver can view bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'driver'::app_role)
    AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
  );

CREATE POLICY "Finance and support can view bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['finance'::app_role,'support'::app_role])
    AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
  );

-- CUSTOMERS
DROP POLICY IF EXISTS "Admin and support can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Driver can view customers" ON public.customers;
DROP POLICY IF EXISTS "Operations can view customers" ON public.customers;

CREATE POLICY "Admin and support can manage customers"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'support'::app_role])
    AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
  )
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role,'support'::app_role])
    AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
  );

CREATE POLICY "Driver can view customers"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'driver'::app_role)
    AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
  );

CREATE POLICY "Operations can view customers"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'operations'::app_role)
    AND (locadora_id = public.get_user_locadora_id(auth.uid()) OR public.is_platform_admin(auth.uid()))
  );
