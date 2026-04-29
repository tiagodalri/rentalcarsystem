-- Helper: verifica se usuário tem qualquer um dos roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles)) $$;

-- Trigger sync team_members -> user_roles
CREATE OR REPLACE FUNCTION public.sync_team_member_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE mapped_role app_role;
BEGIN
  mapped_role := CASE LOWER(NEW.role)
    WHEN 'admin' THEN 'admin'::app_role
    WHEN 'administrador' THEN 'admin'::app_role
    WHEN 'finance' THEN 'finance'::app_role
    WHEN 'financeiro' THEN 'finance'::app_role
    WHEN 'operations' THEN 'operations'::app_role
    WHEN 'operacional' THEN 'operations'::app_role
    WHEN 'support' THEN 'support'::app_role
    WHEN 'atendimento' THEN 'support'::app_role
    ELSE NULL
  END;

  IF NEW.user_id IS NOT NULL AND mapped_role IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND role IN ('admin','finance','operations','support');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, mapped_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sync_team_member_role_trigger ON public.team_members;
CREATE TRIGGER sync_team_member_role_trigger
  AFTER INSERT OR UPDATE OF role, user_id ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_team_member_role();

CREATE OR REPLACE FUNCTION public.unsync_team_member_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.user_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = OLD.user_id
      AND role IN ('admin','finance','operations','support');
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS unsync_team_member_role_trigger ON public.team_members;
CREATE TRIGGER unsync_team_member_role_trigger
  AFTER DELETE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.unsync_team_member_role();

-- BOOKINGS
DROP POLICY IF EXISTS "Admins can manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin and operations can manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Finance and support can view bookings" ON public.bookings;
CREATE POLICY "Admin and operations can manage bookings" ON public.bookings
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[]));
CREATE POLICY "Finance and support can view bookings" ON public.bookings
  FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['finance','support']::app_role[]));

-- VEHICLES
DROP POLICY IF EXISTS "Admins can manage vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Admin and operations can manage vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Finance can view vehicles" ON public.vehicles;
CREATE POLICY "Admin and operations can manage vehicles" ON public.vehicles
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[]));
CREATE POLICY "Finance can view vehicles" ON public.vehicles
  FOR SELECT USING (public.has_role(auth.uid(), 'finance'));

-- VEHICLE_INSPECTIONS
DROP POLICY IF EXISTS "Admins can manage inspections" ON public.vehicle_inspections;
DROP POLICY IF EXISTS "Admin and operations can manage inspections" ON public.vehicle_inspections;
CREATE POLICY "Admin and operations can manage inspections" ON public.vehicle_inspections
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[]));

-- VEHICLE_EXPENSES
DROP POLICY IF EXISTS "Admins can manage vehicle expenses" ON public.vehicle_expenses;
DROP POLICY IF EXISTS "Admin and finance can manage expenses" ON public.vehicle_expenses;
CREATE POLICY "Admin and finance can manage expenses" ON public.vehicle_expenses
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['admin','finance']::app_role[]));

-- VEHICLE_INCIDENTS
DROP POLICY IF EXISTS "Admins can manage vehicle incidents" ON public.vehicle_incidents;
DROP POLICY IF EXISTS "Admin and operations can manage incidents" ON public.vehicle_incidents;
DROP POLICY IF EXISTS "Finance can view incidents" ON public.vehicle_incidents;
CREATE POLICY "Admin and operations can manage incidents" ON public.vehicle_incidents
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[]));
CREATE POLICY "Finance can view incidents" ON public.vehicle_incidents
  FOR SELECT USING (public.has_role(auth.uid(), 'finance'));

-- CUSTOMERS
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Admin and support can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Operations can view customers" ON public.customers;
CREATE POLICY "Admin and support can manage customers" ON public.customers
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['admin','support']::app_role[]));
CREATE POLICY "Operations can view customers" ON public.customers
  FOR SELECT USING (public.has_role(auth.uid(), 'operations'));

-- TEAM_MEMBERS
DROP POLICY IF EXISTS "Admins can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can manage team" ON public.team_members;
CREATE POLICY "Admins can manage team" ON public.team_members
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Admins can manage user_roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);