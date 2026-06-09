DROP TABLE IF EXISTS public.vehicle_geofence_state CASCADE;
DROP TABLE IF EXISTS public.vehicle_geofences CASCADE;
DELETE FROM public.vehicle_events WHERE event_type ILIKE '%geofence%';