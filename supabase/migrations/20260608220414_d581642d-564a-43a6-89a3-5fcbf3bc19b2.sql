
ALTER TABLE public.vehicle_trips ADD COLUMN IF NOT EXISTS time_zone_offset text;
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_trips_transaction_id_key ON public.vehicle_trips (transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vehicle_trips_vehicle_started_idx ON public.vehicle_trips (vehicle_id, started_at DESC);
CREATE INDEX IF NOT EXISTS vehicle_trips_imei_started_idx ON public.vehicle_trips (imei, started_at DESC);
