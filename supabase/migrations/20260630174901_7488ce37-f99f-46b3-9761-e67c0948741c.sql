ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS listed_on_turo boolean NOT NULL DEFAULT false;