
-- Allow the test user to hold both partner and staff roles (demo account only)
CREATE OR REPLACE FUNCTION public.prevent_partner_staff_role_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  test_user_id uuid := 'd9e393eb-bae1-48a0-ac46-fd77bb97115e';
BEGIN
  IF NEW.user_id = test_user_id THEN
    RETURN NEW;
  END IF;
  IF NEW.role = 'partner' AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role <> 'partner'
  ) THEN
    RAISE EXCEPTION 'User already has a staff role; cannot also be a partner';
  END IF;
  IF NEW.role <> 'partner' AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'partner'
  ) THEN
    RAISE EXCEPTION 'User is a partner; cannot also hold a staff role';
  END IF;
  RETURN NEW;
END;
$$;

-- Grant admin role to the test user (scoped to GoDalz HQ locadora)
INSERT INTO public.user_roles (user_id, role, locadora_id)
VALUES ('d9e393eb-bae1-48a0-ac46-fd77bb97115e', 'admin', 'd0da1220-0000-4000-8000-00000000d01a')
ON CONFLICT (user_id, role) DO UPDATE SET locadora_id = EXCLUDED.locadora_id;
