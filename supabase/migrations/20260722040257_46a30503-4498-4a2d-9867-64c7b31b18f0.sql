
-- 1) Add locadora_id to team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS locadora_id uuid REFERENCES public.locadoras(id);

UPDATE public.team_members
   SET locadora_id = 'd0da1220-0000-4000-8000-00000000d01a'
 WHERE locadora_id IS NULL;

ALTER TABLE public.team_members
  ALTER COLUMN locadora_id SET NOT NULL,
  ALTER COLUMN locadora_id SET DEFAULT 'd0da1220-0000-4000-8000-00000000d01a';

CREATE INDEX IF NOT EXISTS team_members_locadora_id_idx
  ON public.team_members(locadora_id);

-- Reuse Phase 0 trigger to auto-fill locadora_id from caller
DROP TRIGGER IF EXISTS set_locadora_id_team_members ON public.team_members;
CREATE TRIGGER set_locadora_id_team_members
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_locadora_id_from_user();

-- 2) Rewrite RLS on team_members scoped by locadora
DROP POLICY IF EXISTS "Admins can manage team" ON public.team_members;
DROP POLICY IF EXISTS "Staff can view team members" ON public.team_members;

CREATE POLICY "Admins can manage team"
  ON public.team_members
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (
      locadora_id = public.get_user_locadora_id(auth.uid())
      OR public.is_platform_admin(auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (
      locadora_id = public.get_user_locadora_id(auth.uid())
      OR public.is_platform_admin(auth.uid())
    )
  );

CREATE POLICY "Staff can view team members"
  ON public.team_members
  FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support']::app_role[])
    AND (
      locadora_id = public.get_user_locadora_id(auth.uid())
      OR public.is_platform_admin(auth.uid())
    )
  );

-- 3) Update sync_team_member_role to propagate locadora_id into user_roles
CREATE OR REPLACE FUNCTION public.sync_team_member_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHEN 'driver' THEN 'driver'::app_role
    WHEN 'motorista' THEN 'driver'::app_role
    WHEN 'operador' THEN 'driver'::app_role
    WHEN 'operador de rua' THEN 'driver'::app_role
    ELSE NULL
  END;

  IF NEW.user_id IS NOT NULL AND mapped_role IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND role IN ('admin','finance','operations','support','driver');
    INSERT INTO public.user_roles (user_id, role, locadora_id)
    VALUES (NEW.user_id, mapped_role, NEW.locadora_id)
    ON CONFLICT (user_id, role) DO UPDATE SET locadora_id = EXCLUDED.locadora_id;
  END IF;
  RETURN NEW;
END $function$;
