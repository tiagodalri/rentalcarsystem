
-- 1. Add audit columns
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. RLS: customers can cancel their own future pending/confirmed bookings
CREATE POLICY "Customers can cancel own bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  AND status IN ('pending', 'confirmed')
  AND pickup_date > CURRENT_DATE
)
WITH CHECK (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  AND status = 'cancelled'
);
