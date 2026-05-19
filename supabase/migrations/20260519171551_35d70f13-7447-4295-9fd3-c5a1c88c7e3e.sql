
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_refund_days integer,
  ADD COLUMN IF NOT EXISTS franchise_amount numeric DEFAULT 0;
