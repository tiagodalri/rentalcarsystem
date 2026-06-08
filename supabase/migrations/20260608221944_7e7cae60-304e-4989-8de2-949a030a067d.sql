
-- 1) vehicles.bouncie_raw
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS bouncie_raw jsonb;

-- 2) trip_events
CREATE TABLE IF NOT EXISTS public.trip_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id text REFERENCES public.vehicle_trips(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  imei text,
  type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  lat double precision,
  lng double precision,
  speed_mph numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_events_trip_idx ON public.trip_events(trip_id);
CREATE INDEX IF NOT EXISTS trip_events_vehicle_idx ON public.trip_events(vehicle_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS trip_events_type_idx ON public.trip_events(type);
GRANT SELECT ON public.trip_events TO authenticated;
GRANT ALL ON public.trip_events TO service_role;
ALTER TABLE public.trip_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trip_events readable by authenticated"
  ON public.trip_events FOR SELECT TO authenticated USING (true);

-- 3) bouncie_backfill_progress
CREATE TABLE IF NOT EXISTS public.bouncie_backfill_progress (
  vehicle_id uuid PRIMARY KEY REFERENCES public.vehicles(id) ON DELETE CASCADE,
  imei text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | running | done | error
  stage text NOT NULL DEFAULT 'recent',   -- recent | deep | done
  newest_week_done date,
  oldest_week_done date,
  empty_streak integer NOT NULL DEFAULT 0,
  trips_imported integer NOT NULL DEFAULT 0,
  last_error text,
  last_run timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bouncie_backfill_progress TO authenticated;
GRANT ALL ON public.bouncie_backfill_progress TO service_role;
ALTER TABLE public.bouncie_backfill_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backfill progress readable by authenticated"
  ON public.bouncie_backfill_progress FOR SELECT TO authenticated USING (true);
CREATE TRIGGER bouncie_backfill_progress_updated_at
  BEFORE UPDATE ON public.bouncie_backfill_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Semente: cria 1 linha por veículo com IMEI; veículos já com 6 meses importados começam em 'deep'
INSERT INTO public.bouncie_backfill_progress (vehicle_id, imei, status, stage, newest_week_done, oldest_week_done, trips_imported)
SELECT v.id, v.bouncie_imei, 'pending', 'recent', NULL, NULL, 0
FROM public.vehicles v
WHERE v.bouncie_imei IS NOT NULL
ON CONFLICT (vehicle_id) DO NOTHING;
