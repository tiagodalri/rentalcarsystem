
CREATE OR REPLACE FUNCTION public.get_scheduled_messages_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret
    FROM vault.decrypted_secrets
   WHERE name = 'scheduled_messages_secret'
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_scheduled_messages_secret() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_scheduled_messages_secret() TO service_role;
