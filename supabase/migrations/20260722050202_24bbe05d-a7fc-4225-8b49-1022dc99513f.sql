-- Add commission_payout_status to bookings
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS commission_payout_status text NOT NULL DEFAULT 'pending';

COMMENT ON COLUMN public.bookings.commission_payout_status IS 
  'Status of commission payout to partner. Values: pending | paid. Only meaningful when partner_id IS NOT NULL.';

-- Read-only policy for partners to view their referred bookings
DROP POLICY IF EXISTS "Partners can view own referred bookings" ON public.bookings;
CREATE POLICY "Partners can view own referred bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (partner_id = public.get_user_partner_id(auth.uid()));
