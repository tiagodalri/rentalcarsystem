CREATE OR REPLACE FUNCTION public.increment_quick_reply_usage(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.whatsapp_quick_replies SET usage_count = usage_count + 1 WHERE id = p_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_quick_reply_usage(uuid) TO authenticated;