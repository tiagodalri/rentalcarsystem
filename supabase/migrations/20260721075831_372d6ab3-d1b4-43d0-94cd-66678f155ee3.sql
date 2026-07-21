
-- 1) RPC: assignable staff
CREATE OR REPLACE FUNCTION public.get_assignable_staff()
RETURNS TABLE(user_id uuid, full_name text, email text, role app_role)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (ur.user_id)
    ur.user_id,
    COALESCE(p.full_name, p.email, '') AS full_name,
    p.email,
    ur.role
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('admin','operations','support')
  ORDER BY ur.user_id, ur.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_assignable_staff() TO authenticated;

-- 2) Audit table
CREATE TABLE public.conversation_assignment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  previous_assigned_to uuid,
  new_assigned_to uuid,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.conversation_assignment_log TO authenticated;
GRANT ALL ON public.conversation_assignment_log TO service_role;

ALTER TABLE public.conversation_assignment_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view assignment log"
ON public.conversation_assignment_log
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE INDEX conversation_assignment_log_conv_idx
  ON public.conversation_assignment_log (conversation_id, changed_at DESC);

-- 3) Trigger function + trigger
CREATE OR REPLACE FUNCTION public.log_conversation_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.conversation_assignment_log
    (conversation_id, previous_assigned_to, new_assigned_to, changed_by)
  VALUES
    (NEW.id, OLD.assigned_to, NEW.assigned_to, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_conversation_assignment ON public.whatsapp_conversations;
CREATE TRIGGER trg_log_conversation_assignment
AFTER UPDATE OF assigned_to ON public.whatsapp_conversations
FOR EACH ROW
WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
EXECUTE FUNCTION public.log_conversation_assignment_change();
