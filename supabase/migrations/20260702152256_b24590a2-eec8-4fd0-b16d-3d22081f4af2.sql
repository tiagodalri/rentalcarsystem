UPDATE public.vehicle_telemetry
SET is_running = (COALESCE(speed,0) > 0),
    reported_at = now() - (random()*interval '30 seconds')
WHERE vehicle_id IN (SELECT id FROM public.vehicles WHERE status='rented' AND deleted_at IS NULL);