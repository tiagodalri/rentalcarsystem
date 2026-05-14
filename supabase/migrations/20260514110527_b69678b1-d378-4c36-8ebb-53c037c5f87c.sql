
-- Add photos array to vehicles
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create vehicle-photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Vehicle photos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'vehicle-photos');

CREATE POLICY "Admin and operations can upload vehicle photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vehicle-photos'
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role])
);

CREATE POLICY "Admin and operations can update vehicle photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vehicle-photos'
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role])
);

CREATE POLICY "Admin and operations can delete vehicle photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vehicle-photos'
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role])
);
