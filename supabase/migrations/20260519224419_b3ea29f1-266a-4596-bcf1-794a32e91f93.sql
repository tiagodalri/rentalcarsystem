
-- ============== Soft delete columns ==============
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_bookings_deleted_at ON public.bookings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON public.vehicles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers(deleted_at);

-- ============== Audit logs ==============
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  actor_email text,
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============== Audit trigger function ==============
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_action text;
  v_diff jsonb;
  v_record_id uuid;
BEGIN
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_diff := to_jsonb(NEW);
    v_record_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(OLD) ? 'deleted_at') THEN
      IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        v_action := 'soft_delete';
      ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        v_action := 'restore';
      ELSE
        v_action := 'update';
      END IF;
    ELSE
      v_action := 'update';
    END IF;
    v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    v_record_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_diff := to_jsonb(OLD);
    v_record_id := OLD.id;
  END IF;

  INSERT INTO public.audit_logs(table_name, record_id, action, actor_id, actor_email, diff)
  VALUES (TG_TABLE_NAME, v_record_id, v_action, auth.uid(), v_email, v_diff);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_bookings ON public.bookings;
CREATE TRIGGER audit_bookings AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_vehicles ON public.vehicles;
CREATE TRIGGER audit_vehicles AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_customers ON public.customers;
CREATE TRIGGER audit_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_financial_transactions ON public.financial_transactions;
CREATE TRIGGER audit_financial_transactions AFTER INSERT OR UPDATE OR DELETE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============== Booking → Financial auto-entry ==============
CREATE OR REPLACE FUNCTION public.create_financial_from_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat uuid;
BEGIN
  IF NEW.status IN ('confirmed','active','in_progress','completed')
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status,'') <> NEW.status)
     AND NEW.total_price IS NOT NULL AND NEW.total_price > 0
     AND NEW.deleted_at IS NULL THEN

    SELECT id INTO v_cat FROM public.financial_categories
      WHERE type = 'income' AND LOWER(name) IN ('reservas','aluguel','bookings','rental','locação')
      LIMIT 1;

    IF NOT EXISTS (
      SELECT 1 FROM public.financial_transactions
      WHERE booking_id = NEW.id AND source = 'booking' AND is_cancelled = false
    ) THEN
      INSERT INTO public.financial_transactions(
        type, amount, description, transaction_date,
        booking_id, vehicle_id, category_id, source, notes
      )
      VALUES (
        'income', NEW.total_price,
        'Reserva ' || COALESCE(NEW.booking_number, substring(NEW.id::text,1,8)) || ' — ' || NEW.customer_name,
        NEW.pickup_date, NEW.id, NEW.vehicle_id, v_cat, 'booking',
        'Lançamento automático ao confirmar reserva'
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.financial_transactions
      SET is_cancelled = true
      WHERE booking_id = NEW.id AND source = 'booking';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS booking_to_financial ON public.bookings;
CREATE TRIGGER booking_to_financial AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.create_financial_from_booking();

-- ============== Availability ignores soft-deleted ==============
CREATE OR REPLACE FUNCTION public.check_vehicle_availability(p_vehicle_id uuid, p_pickup date, p_return date, p_exclude_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE vehicle_id = p_vehicle_id
      AND deleted_at IS NULL
      AND status IN ('pending','confirmed','active','in_progress')
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
      AND daterange(pickup_date, return_date, '[]')
          && daterange(p_pickup, p_return, '[]')
  );
$function$;
