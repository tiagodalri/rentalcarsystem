CREATE OR REPLACE FUNCTION public.set_locadora_id_from_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_loc uuid;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT public.get_user_locadora_id(v_uid) INTO v_loc;
    IF v_loc IS NOT NULL THEN
      NEW.locadora_id := v_loc;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;