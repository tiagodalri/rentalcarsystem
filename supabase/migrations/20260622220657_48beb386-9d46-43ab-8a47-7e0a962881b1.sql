CREATE TABLE public.turo_vehicle_mapping (
  turo_vehicle_name TEXT PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.turo_vehicle_mapping TO authenticated;
GRANT ALL ON public.turo_vehicle_mapping TO service_role;

ALTER TABLE public.turo_vehicle_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e operations leem mapeamentos Turo"
  ON public.turo_vehicle_mapping FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[]));

CREATE POLICY "Admins e operations gerenciam mapeamentos Turo"
  ON public.turo_vehicle_mapping FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[]));

CREATE TRIGGER turo_vehicle_mapping_updated_at
  BEFORE UPDATE ON public.turo_vehicle_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_turo_vehicle_mapping_vehicle ON public.turo_vehicle_mapping(vehicle_id);