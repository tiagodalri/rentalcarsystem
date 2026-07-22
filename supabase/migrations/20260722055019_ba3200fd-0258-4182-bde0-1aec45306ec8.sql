
CREATE TABLE public.partner_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  locadora_id uuid NOT NULL REFERENCES public.locadoras(id),
  pickup_date date NOT NULL,
  return_date date NOT NULL,
  pickup_time text,
  return_time text,
  pickup_location text,
  return_location text,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  message text,
  total_price numeric NOT NULL,
  commission_type text,
  commission_value numeric,
  commission_amount numeric,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','accepted','expired','cancelled')),
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_booking_id uuid REFERENCES public.bookings(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_proposals_partner ON public.partner_proposals(partner_id);
CREATE INDEX idx_partner_proposals_token ON public.partner_proposals(token);

GRANT ALL ON public.partner_proposals TO service_role;

ALTER TABLE public.partner_proposals ENABLE ROW LEVEL SECURITY;

-- No permissive policies for anon/authenticated: all access is mediated by edge functions
-- using the service role. Partners cannot query this table directly from the client.
