
CREATE TABLE IF NOT EXISTS public.vehicle_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  name text NOT NULL,
  file_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,
  expires_at date,
  notes text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle ON public.vehicle_documents(vehicle_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_documents TO authenticated;
GRANT ALL ON public.vehicle_documents TO service_role;

ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vehicle documents"
  ON public.vehicle_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert vehicle documents"
  ON public.vehicle_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update vehicle documents"
  ON public.vehicle_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete vehicle documents"
  ON public.vehicle_documents FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_vehicle_documents_updated_at
  BEFORE UPDATE ON public.vehicle_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated read vehicle-documents bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-documents');
CREATE POLICY "Authenticated upload vehicle-documents bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-documents');
CREATE POLICY "Authenticated update vehicle-documents bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-documents') WITH CHECK (bucket_id = 'vehicle-documents');
CREATE POLICY "Authenticated delete vehicle-documents bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-documents');
