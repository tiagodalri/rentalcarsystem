-- 1. Limpeza de testes
DELETE FROM bookings WHERE customer_name LIKE 'RLS Test%';

-- 2. booking_number com sequence + trigger
CREATE SEQUENCE IF NOT EXISTS booking_number_seq START 1;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_number TEXT UNIQUE;

CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.booking_number IS NULL THEN
    NEW.booking_number := 'ZRC-' || lpad(nextval('booking_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS set_booking_number ON bookings;
CREATE TRIGGER set_booking_number
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION generate_booking_number();

-- 3. Backfill existentes
DO $$
DECLARE
  rec RECORD;
  counter INTEGER := 1;
BEGIN
  FOR rec IN SELECT id FROM bookings WHERE booking_number IS NULL ORDER BY created_at ASC LOOP
    UPDATE bookings SET booking_number = 'ZRC-' || lpad(counter::text, 4, '0') WHERE id = rec.id;
    counter := counter + 1;
  END LOOP;
  PERFORM setval('booking_number_seq', counter);
END $$;

-- 4. stripe_session_id
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session ON bookings(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- 5. vehicle_id NOT NULL (FK already exists)
ALTER TABLE bookings ALTER COLUMN vehicle_id SET NOT NULL;

-- 6. RLS — cliente lê próprio booking
CREATE POLICY "Customers can view own bookings" ON bookings
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );