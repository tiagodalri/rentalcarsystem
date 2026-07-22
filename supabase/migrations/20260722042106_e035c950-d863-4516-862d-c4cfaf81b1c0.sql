DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;

CREATE POLICY "Admins can manage staff roles in own locadora"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND (
      is_platform_admin(auth.uid())
      OR (
        role = ANY (ARRAY['admin','operations','support','finance','driver']::app_role[])
        AND locadora_id = get_user_locadora_id(auth.uid())
      )
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND (
      is_platform_admin(auth.uid())
      OR (
        role = ANY (ARRAY['admin','operations','support','finance','driver']::app_role[])
        AND locadora_id = get_user_locadora_id(auth.uid())
      )
    )
  );