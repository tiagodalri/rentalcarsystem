-- Add explicit role-scoped SELECT policy for team_members.
-- Customers (authenticated users without a staff role) must not read staff PII.
-- Staff roles (admin, finance, operations, support) need to read the team list.

CREATE POLICY "Staff can view team members"
ON public.team_members
FOR SELECT
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support']::app_role[])
);
