CREATE UNIQUE INDEX IF NOT EXISTS bookings_turo_reservation_id_unique
ON public.bookings ((addons->>'turo_reservation_id'))
WHERE addons->>'turo_reservation_id' IS NOT NULL;