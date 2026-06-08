
-- 1) State table to remember if a vehicle is currently inside/outside each geofence.
CREATE TABLE IF NOT EXISTS public.vehicle_geofence_state (
  vehicle_id uuid NOT NULL,
  geofence_id uuid NOT NULL,
  inside boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vehicle_id, geofence_id)
);

GRANT SELECT ON public.vehicle_geofence_state TO authenticated;
GRANT ALL ON public.vehicle_geofence_state TO service_role;

ALTER TABLE public.vehicle_geofence_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view geofence state"
  ON public.vehicle_geofence_state
  FOR SELECT
  TO authenticated
  USING (true);

-- 2) Allow authenticated admins to manage geofences from the Live map.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicle_geofences'
      AND policyname = 'Authenticated can insert geofences'
  ) THEN
    CREATE POLICY "Authenticated can insert geofences"
      ON public.vehicle_geofences
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicle_geofences'
      AND policyname = 'Authenticated can update geofences'
  ) THEN
    CREATE POLICY "Authenticated can update geofences"
      ON public.vehicle_geofences
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicle_geofences'
      AND policyname = 'Authenticated can delete geofences'
  ) THEN
    CREATE POLICY "Authenticated can delete geofences"
      ON public.vehicle_geofences
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

GRANT INSERT, UPDATE, DELETE ON public.vehicle_geofences TO authenticated;
