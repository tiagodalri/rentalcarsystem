
-- Funnel stage + tags on conversations
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'novo_lead',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- Quick replies
CREATE TABLE IF NOT EXISTS public.whatsapp_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  shortcut text,
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_quick_replies TO authenticated;
GRANT ALL ON public.whatsapp_quick_replies TO service_role;

ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage quick replies" ON public.whatsapp_quick_replies;
CREATE POLICY "Staff manage quick replies" ON public.whatsapp_quick_replies
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

DROP TRIGGER IF EXISTS update_whatsapp_quick_replies_updated_at ON public.whatsapp_quick_replies;
CREATE TRIGGER update_whatsapp_quick_replies_updated_at
  BEFORE UPDATE ON public.whatsapp_quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Customer lookup by digit suffix (used by zapi-webhook)
CREATE OR REPLACE FUNCTION public.find_customer_by_phone_digits(p_digits text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.customers
  WHERE phone IS NOT NULL
    AND length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 10
    AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = right(p_digits, 10)
  ORDER BY created_at ASC
  LIMIT 1;
$$;
