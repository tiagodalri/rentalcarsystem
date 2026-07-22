
-- 1) partners table
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- 2) partner_id on user_roles
ALTER TABLE public.user_roles ADD COLUMN partner_id uuid REFERENCES public.partners(id);

-- 3) helper function
CREATE OR REPLACE FUNCTION public.get_user_partner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT partner_id FROM public.user_roles
  WHERE user_id = _user_id AND role = 'partner' AND partner_id IS NOT NULL
  LIMIT 1;
$$;

-- 4) RLS policies on partners
CREATE POLICY "Platform admins manage partners"
ON public.partners FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Partners can view own agency"
ON public.partners FOR SELECT
TO authenticated
USING (id = public.get_user_partner_id(auth.uid()));

-- 5) Backfill test user before applying CHECK constraint
DO $$
DECLARE
  v_partner_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = 'd9e393eb-bae1-48a0-ac46-fd77bb97115e'
      AND role = 'partner'
  ) THEN
    INSERT INTO public.partners (agency_name, status, created_by)
    VALUES ('Agência Teste', 'active', NULL)
    RETURNING id INTO v_partner_id;

    UPDATE public.user_roles
    SET locadora_id = NULL, partner_id = v_partner_id
    WHERE user_id = 'd9e393eb-bae1-48a0-ac46-fd77bb97115e'
      AND role = 'partner';
  END IF;
END $$;

-- 6) Consistency CHECK on user_roles
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_partner_scope_check CHECK (
  (role = 'partner' AND locadora_id IS NULL AND partner_id IS NOT NULL)
  OR (role <> 'partner' AND partner_id IS NULL)
);

-- 7) updated_at trigger
CREATE TRIGGER update_partners_updated_at
BEFORE UPDATE ON public.partners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
