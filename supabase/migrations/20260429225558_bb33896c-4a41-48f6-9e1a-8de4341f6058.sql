-- 1. Add last_login_at column
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. SECURITY DEFINER function: only updates the caller's own last_login_at
-- Scope guarantee: WHERE user_id = auth.uid() — cannot touch other rows or other columns.
CREATE OR REPLACE FUNCTION public.record_last_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.team_members
  SET last_login_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- Allow authenticated users to call it (function-level grant; scope is enforced by the WHERE clause above)
REVOKE ALL ON FUNCTION public.record_last_login() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_last_login() TO authenticated;