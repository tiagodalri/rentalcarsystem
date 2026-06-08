CREATE TABLE public.public_track_links (
  token text PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  label text,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_public_track_links_vehicle ON public.public_track_links(vehicle_id);
CREATE INDEX idx_public_track_links_active ON public.public_track_links(vehicle_id) WHERE revoked = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_track_links TO authenticated;
GRANT ALL ON public.public_track_links TO service_role;

ALTER TABLE public.public_track_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view all share links"
  ON public.public_track_links FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support']::app_role[])
  );

CREATE POLICY "Team can create share links"
  ON public.public_track_links FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support']::app_role[])
    AND created_by = auth.uid()
  );

CREATE POLICY "Team can update/revoke share links"
  ON public.public_track_links FOR UPDATE
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support']::app_role[])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support']::app_role[])
  );

CREATE POLICY "Admins can delete share links"
  ON public.public_track_links FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
