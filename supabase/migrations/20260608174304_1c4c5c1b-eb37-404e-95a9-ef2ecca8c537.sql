
-- 1) Vehicles: novas colunas
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS bouncie_imei text UNIQUE,
  ADD COLUMN IF NOT EXISTS bouncie_vin text;

-- 2) vehicle_telemetry (1 linha por veículo)
CREATE TABLE IF NOT EXISTS public.vehicle_telemetry (
  vehicle_id uuid PRIMARY KEY REFERENCES public.vehicles(id) ON DELETE CASCADE,
  imei text,
  lat double precision,
  lng double precision,
  heading double precision,
  speed double precision,
  is_running boolean,
  odometer double precision,
  fuel_level double precision,
  battery_status text,
  mil_on boolean DEFAULT false,
  dtc_codes jsonb DEFAULT '[]'::jsonb,
  address text,
  last_event text,
  reported_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.vehicle_telemetry TO authenticated;
GRANT ALL ON public.vehicle_telemetry TO service_role;
ALTER TABLE public.vehicle_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view telemetry"
  ON public.vehicle_telemetry FOR SELECT TO authenticated USING (true);

-- 3) vehicle_telemetry_history
CREATE TABLE IF NOT EXISTS public.vehicle_telemetry_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  lat double precision,
  lng double precision,
  speed double precision,
  heading double precision,
  event_type text,
  reported_at timestamptz,
  raw jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vth_vehicle_reported
  ON public.vehicle_telemetry_history (vehicle_id, reported_at DESC);
GRANT SELECT ON public.vehicle_telemetry_history TO authenticated;
GRANT ALL ON public.vehicle_telemetry_history TO service_role;
ALTER TABLE public.vehicle_telemetry_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view telemetry history"
  ON public.vehicle_telemetry_history FOR SELECT TO authenticated USING (true);

-- 4) vehicle_trips
CREATE TABLE IF NOT EXISTS public.vehicle_trips (
  id text PRIMARY KEY,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  imei text,
  started_at timestamptz,
  ended_at timestamptz,
  distance_mi double precision,
  hard_braking integer,
  hard_accel integer,
  gps jsonb,
  raw jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.vehicle_trips TO authenticated;
GRANT ALL ON public.vehicle_trips TO service_role;
ALTER TABLE public.vehicle_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view trips"
  ON public.vehicle_trips FOR SELECT TO authenticated USING (true);

-- 5) bouncie_integration (single-row, server only)
CREATE TABLE IF NOT EXISTS public.bouncie_integration (
  id int PRIMARY KEY DEFAULT 1,
  client_id text,
  authorization_code text,
  access_token text,
  token_expires_at timestamptz,
  connected_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT bouncie_integration_singleton CHECK (id = 1)
);
GRANT ALL ON public.bouncie_integration TO service_role;
ALTER TABLE public.bouncie_integration ENABLE ROW LEVEL SECURITY;
-- intentionally no policy: only service_role can access
INSERT INTO public.bouncie_integration (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- 6) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_telemetry;
