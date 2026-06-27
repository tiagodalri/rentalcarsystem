
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS turo_reservation_code TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_turo_reservation_code
  ON public.bookings (turo_reservation_code)
  WHERE turo_reservation_code IS NOT NULL;

-- Backfill 1: from addons JSON (set by importer)
UPDATE public.bookings
   SET turo_reservation_code = addons->>'turo_reservation_id'
 WHERE turo_reservation_code IS NULL
   AND addons ? 'turo_reservation_id'
   AND length(coalesce(addons->>'turo_reservation_id','')) > 0;

-- Backfill 2: from notes URL (legacy imports)
UPDATE public.bookings
   SET turo_reservation_code = (regexp_match(notes, 'reservation/([0-9]+)'))[1]
 WHERE turo_reservation_code IS NULL
   AND notes ~ 'reservation/[0-9]+';
