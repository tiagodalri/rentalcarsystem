
-- 1) payment_requests
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  order_id text UNIQUE,
  cr_id bigint,
  cr_token text,
  cr_code text,
  amount_usd numeric,
  status text NOT NULL DEFAULT 'AGUARDANDO_CLIENTE',
  payment_method text,
  checkout_url text,
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payment_requests_cr_token_uidx
  ON public.payment_requests(cr_token) WHERE cr_token IS NOT NULL;
CREATE INDEX payment_requests_booking_idx ON public.payment_requests(booking_id);

GRANT ALL ON public.payment_requests TO service_role;

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- No public/anon/authenticated policies on purpose: only service_role (bypasses RLS) reads/writes.
-- Add an admin-read policy so the admin panel can list payment requests if needed.
CREATE POLICY "Admins can view payment requests"
  ON public.payment_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_payment_requests_updated
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) bookings: hold_expires_at
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS bookings_hold_expires_idx
  ON public.bookings(hold_expires_at) WHERE hold_expires_at IS NOT NULL;

-- 3) check_vehicle_availability: include pending_payment with active hold
CREATE OR REPLACE FUNCTION public.check_vehicle_availability(
  p_vehicle_id uuid, p_pickup date, p_return date, p_exclude_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE vehicle_id = p_vehicle_id
      AND deleted_at IS NULL
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
      AND (
        status IN ('pending','confirmed','active','in_progress')
        OR (status = 'pending_payment' AND hold_expires_at IS NOT NULL AND hold_expires_at > now())
      )
      AND daterange(pickup_date, return_date, '[)')
          && daterange(p_pickup, p_return, '[)')
  );
$function$;
