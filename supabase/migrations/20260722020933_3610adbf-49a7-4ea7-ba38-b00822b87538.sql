
-- Default constante = locadora GoDalz (torna a coluna opcional nos tipos gerados).
ALTER TABLE public.vehicles  ALTER COLUMN locadora_id SET DEFAULT 'd0da1220-0000-4000-8000-00000000d01a';
ALTER TABLE public.bookings  ALTER COLUMN locadora_id SET DEFAULT 'd0da1220-0000-4000-8000-00000000d01a';
ALTER TABLE public.customers ALTER COLUMN locadora_id SET DEFAULT 'd0da1220-0000-4000-8000-00000000d01a';

-- Trigger que sobrescreve pelo locadora do usuário autenticado quando houver um.
CREATE OR REPLACE FUNCTION public.set_locadora_id_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_loc uuid;
BEGIN
  IF NEW.locadora_id IS NULL AND v_uid IS NOT NULL THEN
    SELECT public.get_user_locadora_id(v_uid) INTO v_loc;
    IF v_loc IS NOT NULL THEN
      NEW.locadora_id := v_loc;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vehicles_set_locadora
  BEFORE INSERT ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_locadora_id_from_user();

CREATE TRIGGER trg_bookings_set_locadora
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_locadora_id_from_user();

CREATE TRIGGER trg_customers_set_locadora
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_locadora_id_from_user();
