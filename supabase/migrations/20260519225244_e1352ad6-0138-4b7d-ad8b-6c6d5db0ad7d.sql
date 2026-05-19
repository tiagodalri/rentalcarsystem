
ALTER TABLE public.bookings
  ALTER COLUMN deposit_refund_days SET DEFAULT 30;

UPDATE public.bookings
SET deposit_refund_days = 30
WHERE deposit_refund_days IS NULL;
