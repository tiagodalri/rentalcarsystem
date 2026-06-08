
-- Enrich vehicle_trips with extra fields from Bouncie
ALTER TABLE public.vehicle_trips
  ADD COLUMN IF NOT EXISTS transaction_id text,
  ADD COLUMN IF NOT EXISTS start_odometer numeric,
  ADD COLUMN IF NOT EXISTS end_odometer numeric,
  ADD COLUMN IF NOT EXISTS fuel_consumed_gal numeric,
  ADD COLUMN IF NOT EXISTS average_mpg numeric,
  ADD COLUMN IF NOT EXISTS start_address text,
  ADD COLUMN IF NOT EXISTS end_address text,
  ADD COLUMN IF NOT EXISTS start_lat double precision,
  ADD COLUMN IF NOT EXISTS start_lng double precision,
  ADD COLUMN IF NOT EXISTS end_lat double precision,
  ADD COLUMN IF NOT EXISTS end_lng double precision,
  ADD COLUMN IF NOT EXISTS idle_seconds integer,
  ADD COLUMN IF NOT EXISTS max_speed_mph numeric,
  ADD COLUMN IF NOT EXISTS avg_speed_mph numeric,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_trips_transaction_id_idx
  ON public.vehicle_trips(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vehicle_trips_vehicle_started_idx
  ON public.vehicle_trips(vehicle_id, started_at DESC);

-- 1) Vehicle events (webhooks + derived events)
CREATE TABLE IF NOT EXISTS public.vehicle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  imei text,
  event_type text NOT NULL, -- tripStart, tripEnd, hardBraking, hardAcceleration, speeding, connect, disconnect, mil, ignition_on, ignition_off, idle_start, idle_end
  occurred_at timestamptz NOT NULL,
  lat double precision,
  lng double precision,
  speed_mph numeric,
  severity text, -- info | warning | critical
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_events TO authenticated;
GRANT ALL ON public.vehicle_events TO service_role;
ALTER TABLE public.vehicle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view vehicle events" ON public.vehicle_events
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support']::app_role[]));

CREATE POLICY "Service role manages vehicle events" ON public.vehicle_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS vehicle_events_vehicle_time_idx
  ON public.vehicle_events(vehicle_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS vehicle_events_type_idx
  ON public.vehicle_events(event_type, occurred_at DESC);

-- 2) Vehicle diagnostics (snapshots of OBD/health data)
CREATE TABLE IF NOT EXISTS public.vehicle_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  imei text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  mil_on boolean,
  dtc_codes text[],
  battery_voltage numeric,
  fuel_level_pct numeric,
  odometer_mi numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_diagnostics TO authenticated;
GRANT ALL ON public.vehicle_diagnostics TO service_role;
ALTER TABLE public.vehicle_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view diagnostics" ON public.vehicle_diagnostics
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support']::app_role[]));

CREATE POLICY "Service role manages diagnostics" ON public.vehicle_diagnostics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS vehicle_diagnostics_vehicle_time_idx
  ON public.vehicle_diagnostics(vehicle_id, recorded_at DESC);

-- 3) Vehicle geofences
CREATE TABLE IF NOT EXISTS public.vehicle_geofences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  bouncie_id text,
  name text NOT NULL,
  geometry jsonb NOT NULL, -- {type:'circle', lat, lng, radius_m} or {type:'polygon', points:[[lat,lng],...]}
  active boolean NOT NULL DEFAULT true,
  notify_on_enter boolean NOT NULL DEFAULT true,
  notify_on_exit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_geofences TO authenticated;
GRANT ALL ON public.vehicle_geofences TO service_role;
ALTER TABLE public.vehicle_geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view geofences" ON public.vehicle_geofences
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance','operations','support']::app_role[]));

CREATE POLICY "Admin/ops manage geofences" ON public.vehicle_geofences
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[]));

CREATE POLICY "Service role manages geofences" ON public.vehicle_geofences
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_vehicle_geofences_updated_at
  BEFORE UPDATE ON public.vehicle_geofences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS vehicle_geofences_vehicle_idx
  ON public.vehicle_geofences(vehicle_id);
