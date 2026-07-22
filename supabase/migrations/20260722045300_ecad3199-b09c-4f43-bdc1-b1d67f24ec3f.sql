
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_partner_id_idx ON public.bookings(partner_id) WHERE partner_id IS NOT NULL;

CREATE OR REPLACE VIEW public.partners_public AS
  SELECT id, agency_name FROM public.partners;

GRANT SELECT ON public.partners_public TO authenticated;
