
-- 1) Recreate trigger function WITHOUT any per-user bypass
CREATE OR REPLACE FUNCTION public.prevent_partner_staff_role_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'partner' AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role <> 'partner'
  ) THEN
    RAISE EXCEPTION 'User already has a staff role; cannot also be a partner';
  END IF;
  IF NEW.role <> 'partner' AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'partner'
  ) THEN
    RAISE EXCEPTION 'User is a partner; cannot also hold a staff role';
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Clean up leftover test data: remove any staff roles from users that also hold 'partner'
--    This restores the invariant enforced by the trigger.
DELETE FROM public.user_roles
WHERE role <> 'partner'
  AND user_id IN (
    SELECT user_id FROM public.user_roles WHERE role = 'partner'
  );
