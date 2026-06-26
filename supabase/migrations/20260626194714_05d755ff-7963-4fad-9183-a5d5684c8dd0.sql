
CREATE TABLE public.public_inspection_links (
  token text PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  inspection_type text NOT NULL CHECK (inspection_type IN ('checkin','checkout')),
  label text,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_public_inspection_links_booking ON public.public_inspection_links(booking_id);
CREATE INDEX idx_public_inspection_links_active ON public.public_inspection_links(booking_id) WHERE revoked = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_inspection_links TO authenticated;
GRANT ALL ON public.public_inspection_links TO service_role;

ALTER TABLE public.public_inspection_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view inspection share links"
  ON public.public_inspection_links FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support','driver']::app_role[]));

CREATE POLICY "Team can create inspection share links"
  ON public.public_inspection_links FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support','driver']::app_role[])
    AND created_by = auth.uid()
  );

CREATE POLICY "Team can update inspection share links"
  ON public.public_inspection_links FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support','driver']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support','driver']::app_role[]));

CREATE POLICY "Admins can delete inspection share links"
  ON public.public_inspection_links FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
