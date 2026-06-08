
-- 1) Tighten public vehicle SELECT policy
DROP POLICY IF EXISTS "Anyone can view vehicles" ON public.vehicles;
CREATE POLICY "Anyone can view vehicles"
ON public.vehicles
FOR SELECT
USING (published = true AND deleted_at IS NULL);

-- 2) Revoke EXECUTE on trigger-only / internal SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_financial_from_booking() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_existing_customer_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_team_member_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unsync_team_member_role() FROM PUBLIC, anon, authenticated;

-- Revoke anon execute from admin-only RPCs (keep authenticated)
REVOKE EXECUTE ON FUNCTION public.get_occupancy_rate() FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_last_login() FROM anon;

-- 3) Move btree_gist extension out of public
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER EXTENSION btree_gist SET SCHEMA extensions;
