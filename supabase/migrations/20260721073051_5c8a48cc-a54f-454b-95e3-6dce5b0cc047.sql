
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.claim_scheduled_messages(p_limit int DEFAULT 20)
RETURNS SETOF public.scheduled_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.scheduled_messages
     SET status = 'sending'
   WHERE id IN (
     SELECT id
       FROM public.scheduled_messages
      WHERE status = 'pending'
        AND scheduled_for <= now()
      ORDER BY scheduled_for
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
   RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_scheduled_messages(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_messages(int) TO service_role;
