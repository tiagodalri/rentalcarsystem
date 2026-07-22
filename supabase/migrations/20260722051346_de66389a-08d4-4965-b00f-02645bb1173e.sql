CREATE OR REPLACE FUNCTION public.prevent_partner_staff_role_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_prevent_partner_staff_overlap ON public.user_roles;
CREATE TRIGGER trg_prevent_partner_staff_overlap
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_partner_staff_role_overlap();