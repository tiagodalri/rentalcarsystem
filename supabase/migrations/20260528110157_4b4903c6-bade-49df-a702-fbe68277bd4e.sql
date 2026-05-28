CREATE OR REPLACE FUNCTION public.create_financial_from_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      WHERE booking_id = NEW.id AND source = 'booking_auto' AND is_cancelled = false
    ) THEN
      INSERT INTO public.financial_transactions(
        type, amount, description, transaction_date,
        booking_id, vehicle_id, category_id, source, notes
      )
      VALUES (
        'income', NEW.total_price,
        'Reserva ' || COALESCE(NEW.booking_number, substring(NEW.id::text,1,8)) || ' — ' || NEW.customer_name,
        NEW.pickup_date, NEW.id, NEW.vehicle_id, v_cat, 'booking_auto',
        'Lançamento automático ao confirmar reserva'
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.financial_transactions
      SET is_cancelled = true
      WHERE booking_id = NEW.id AND source = 'booking_auto';
  END IF;

  RETURN NEW;
END $function$;