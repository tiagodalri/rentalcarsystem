
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name text NOT NULL,
  legal_name text,
  cnpj text,
  state_registration text,
  contact_name text NOT NULL,
  contact_role text,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  address_zip text,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_partner_id uuid REFERENCES public.partners(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.partner_applications TO service_role;

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
-- Intencional: nenhuma policy. Acesso apenas via edge functions (service role).

CREATE INDEX IF NOT EXISTS partner_applications_status_created_idx
  ON public.partner_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_applications_email_idx
  ON public.partner_applications (contact_email);
CREATE INDEX IF NOT EXISTS partner_applications_cnpj_idx
  ON public.partner_applications (cnpj);

CREATE UNIQUE INDEX IF NOT EXISTS partners_cnpj_key
  ON public.partners (cnpj) WHERE cnpj IS NOT NULL AND cnpj <> '';
