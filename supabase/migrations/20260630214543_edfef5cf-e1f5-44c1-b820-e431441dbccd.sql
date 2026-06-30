
-- 1) Restrict customer cancel: only status + cancellation_reason may change
CREATE OR REPLACE FUNCTION public.enforce_customer_cancel_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
BEGIN
  -- staff bypass
  is_staff := public.has_any_role(auth.uid(), ARRAY['admin','operations','finance','support','driver']::app_role[]);
  IF is_staff OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- caller is a customer: only allow status (-> cancelled) + cancellation_reason changes
  IF NEW.status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'Customers may only set status to cancelled';
  END IF;

  IF ROW(
    NEW.customer_id, NEW.vehicle_id, NEW.pickup_date, NEW.return_date,
    NEW.pickup_time, NEW.return_time, NEW.pickup_location, NEW.return_location,
    NEW.total_price, NEW.daily_price, NEW.payment_method, NEW.payment_status,
    NEW.booking_number, NEW.customer_name, NEW.customer_email, NEW.customer_phone,
    NEW.deleted_at, NEW.hold_expires_at, NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.customer_id, OLD.vehicle_id, OLD.pickup_date, OLD.return_date,
    OLD.pickup_time, OLD.return_time, OLD.pickup_location, OLD.return_location,
    OLD.total_price, OLD.daily_price, OLD.payment_method, OLD.payment_status,
    OLD.booking_number, OLD.customer_name, OLD.customer_email, OLD.customer_phone,
    OLD.deleted_at, OLD.hold_expires_at, OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Customers may only modify status and cancellation_reason';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_enforce_customer_cancel_scope ON public.bookings;
CREATE TRIGGER bookings_enforce_customer_cancel_scope
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_customer_cancel_scope();

-- 2) Realtime: deny anon and lock broadcast/presence on activity_logs topics
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='realtime' AND c.relname='messages') THEN

    EXECUTE 'DROP POLICY IF EXISTS "Deny activity_logs broadcast/presence" ON realtime.messages';
    EXECUTE $p$
      CREATE POLICY "Deny activity_logs broadcast/presence"
      ON realtime.messages
      AS RESTRICTIVE
      FOR ALL
      TO anon, authenticated
      USING (
        NOT (
          (realtime.topic() LIKE 'activity_logs%')
          AND (extension IN ('broadcast','presence'))
        )
      )
      WITH CHECK (
        NOT (
          (realtime.topic() LIKE 'activity_logs%')
          AND (extension IN ('broadcast','presence'))
        )
      )
    $p$;
  END IF;
END $$;
