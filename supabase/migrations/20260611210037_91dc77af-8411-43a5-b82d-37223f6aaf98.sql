
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS turo_guest_id text;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_source_check;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_source_check CHECK (source IN ('regular','turo'));

CREATE UNIQUE INDEX IF NOT EXISTS customers_turo_guest_id_key
  ON public.customers (turo_guest_id) WHERE turo_guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_source ON public.customers (source);
