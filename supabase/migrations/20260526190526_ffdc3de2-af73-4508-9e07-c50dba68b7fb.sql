
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS clicksign_envelope_id text,
  ADD COLUMN IF NOT EXISTS clicksign_document_key text,
  ADD COLUMN IF NOT EXISTS contract_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_signed_pdf_url text,
  ADD COLUMN IF NOT EXISTS contract_error text;

CREATE INDEX IF NOT EXISTS idx_bookings_clicksign_envelope_id
  ON public.bookings (clicksign_envelope_id)
  WHERE clicksign_envelope_id IS NOT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('signed-contracts', 'signed-contracts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff can read signed contracts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signed-contracts'
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance'::app_role, 'operations'::app_role])
);

CREATE POLICY "Staff can upload signed contracts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'signed-contracts'
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role])
);

CREATE POLICY "Staff can update signed contracts"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'signed-contracts'
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role])
);
